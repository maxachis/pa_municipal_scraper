

const {launchBrowser, actionWithRetry, finReportSelectors} = require("./util");
const sqlite3 = require("sqlite3");
const fs = require("fs");
const ExcelExtractor = require("./ExcelExtractor");
const displayButtonSelector = 'input[id="ContentPlaceHolder1_btnDisplay"]';
const errorSpanSelector = 'span[id="ContentPlaceHolder1_lblError"]';
const errorMessage = "This report is not available at this time"


class Scraper {

    constructor() {
        this.page = null;
        this.client = null;
        this.browser = null;
        this.db = null;
        this.excel_extractor = null;
    }

    // Static async factory method
    static async build(url) {
        const scraper = new Scraper();
        const {page, client, browser} = await launchBrowser(url, true);
        scraper.page = page;
        scraper.client = client;
        scraper.browser = browser;
        scraper.db = new sqlite3.Database('./scraperCache.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error when connecting to the cache database', err.message);
            } else {
                console.log('Connected to the cache database.');
            }
        });
        scraper.excel_extractor = new ExcelExtractor();
        scraper.downloadPath = process.cwd() + '\\Outputs'
        scraper.excelPath = scraper.downloadPath + '\\mAfrForm.xlsx'
        await scraper.ensureDirectoryExists(scraper.downloadPath);
        await scraper.setupDownloadDirectory(client);

        return scraper;
    }

    async setupDownloadDirectory(client) {
        client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.downloadPath
        });
    }

    async ensureDirectoryExists(directoryPath) {
        try {
            fs.mkdirSync(directoryPath, { recursive: true });
            console.log(`Directory ensured: ${directoryPath}`);
        } catch (error) {
            console.error(`Error ensuring directory: ${error}`);
            throw error; // Rethrow if you need to handle it further up
        }
    }

    async scrapeUnretrievedReports() {
        // Scrape all the unretrieved reports
        const unretrievedSelections = await this.getUnretrievedReports();

        for (const selection of unretrievedSelections) {
            await this.scrapeReport(selection);
            // break;
        }
    }

    async getUnretrievedReports() {
        return await new Promise((resolve, reject) => {
            this.db.all(`SELECT county, municipality, year
                FROM FinReportCache WHERE status in ('NOT_ATTEMPTED', 'RETRIEVAL_FAILED')
                ORDER BY county, municipality, year`,
                (err, rows) => {
                    if (err) {
                        console.error('Error getting unretrieved selections', err.message);
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                });
        });
    }

    waitForFileDownload(filePath, timeout = 30000) {
    let prevFileSize = 0;
    let retries = timeout / 1000; // Check every second
    // console.log('Waiting for file download at ', filePath)

    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.log('An error occurred while checking the file stats:', err);
                if (err.code === 'ENOENT' && retries > 0) {
                    console.log('File not found, waiting and trying again');
                    retries--;
                    return;
                }
                console.log('Stopping due to an error');
                clearInterval(interval);
                return reject(err);
            }

            const currentSize = stats.size;
            // console.log(`Current file size: ${currentSize}`);
            if (currentSize === prevFileSize && retries <= 0) {
                // console.log('File size has not changed, assuming download is complete');
                clearInterval(interval);
                resolve(filePath);

            } else {
                // console.log('File size has changed or there are retries left, updating file size and waiting to check again');
                prevFileSize = currentSize;
                retries--;
            }
        });
        }, 1000);
    });
    }

    async selectOptionByText(selector, text) {
        await actionWithRetry(async () => {
            await this.page.waitForSelector(selector);
            const {value, options} = await this.page.evaluate((selector, text) => {
                const select = document.querySelector(selector);
                const options = Array.from(select.options).map(opt => opt.text);
                // If option is not undefined, console.log the value of the option
                const option = Array.from(select.options).find(opt => opt.text === text.toString());
                return { value: option ? option.value : null, options };
            }, selector, text);
            if (value !== null) {
                await this.page.select(selector, value);
            } else {
                throw new Error(`Option with text "${text}" not found for selector "${selector}". Available options are: ${options.join(', ')}`);
            }
        }, ['not found for selector']);
    }


    async  checkIfErrorPresent(page) {
        return await page.evaluate((selector, errorMessage) => {
            const errorElement = document.querySelector(selector);
            // Check if the error element exists and contains the specific error message
            return errorElement && errorElement.textContent.includes(errorMessage);
        }, errorSpanSelector, errorMessage);
    }

    async downloadReport() {
        // Download the

        await actionWithRetry(async () => {
            const isErrorPresent = await this.checkIfErrorPresent(this.page);
            if (isErrorPresent) {
                console.log('Error message detected, not proceeding with exportReport.');
                return;
            }
            await this.page.evaluate(() => {
                console.log("Proceeding with export")
                $find('ctl00_ContentPlaceHolder1_rvReport').exportReport('EXCELOPENXML');
            });
        });
    }

    async deleteFile(filePath) {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }

    async scrapeReport(selection) {
        console.log('Scraping report for', selection)
        for (const {selector, type} of finReportSelectors) {
            await this.selectOptionByText(selector, selection[type]);
        }
        await this.clickDisplayReportButton(this.page);
        await this.waitForDisplayReportButtonToBeReEnabled();
        // const url = await this.getDownloadUrl()
        // await this.downloadByUrl(url);
        await this.downloadReport();
        await this.waitForFileDownload(this.excelPath, 3000);
        // console.log('Downloaded file')
        this.excel_extractor.loadWorkbook(this.excelPath);
        // Obtain police and total expenditures
        const {policeExpenditure, totalExpenditure} = this.excel_extractor.getPoliceAndTotalExpenditures()
        // Update the cache with the police and total expenditures
        this.updateEntryExpenditures(selection.county, selection.municipality, selection.year, policeExpenditure, totalExpenditure);

    }

    async waitForDisplayReportButtonToBeReEnabled() {
        await this.page.waitForFunction((selector) => {
            const btn = document.querySelector(selector);
            return btn.value === 'Display Report' && !btn.disabled;
        }, {polling: 'mutation'}, displayButtonSelector);
    }

    async updateEntryStatus(county, municipality, year, status) {
        this.db.run(`UPDATE FinReportCache SET status = ? WHERE county = ? AND municipality = ? AND year = ?`, [status, county, municipality, year], (err) => {
            if (err) {
                console.error('Error updating cache', err.message);
            }
        });
    }

    async updateEntryExpenditures(county, municipality, year, police_expenditures, total_expenditures) {
        this.db.run(`UPDATE FinReportCache SET police_expenditures = ?, total_expenditures = ?, status='RETRIEVED'
            WHERE county = ? AND municipality = ? AND year = ?`,
            [police_expenditures, total_expenditures, county, municipality, year], (err) => {
            if (err) {
                console.error('Error updating cache', err.message);
            }
        });
        console.log('Updated cache with police and total expenditures')
    }

    async clickDisplayReportButton(page) {
        // console.log("Attempting to click Display Report button")
        await actionWithRetry(async () => {
            await page.waitForFunction((selector) => {
                const element = document.querySelector(selector);
                return element && !element.disabled && element.offsetParent !== null;
            }, {}, displayButtonSelector);

            await Promise.all([
                page.click(displayButtonSelector, {waitUntil: 'networkidle2'}),
            ]);
        });
        // console.log('Clicked Display Report button')
    }
}

async function scrapeData() {
    const scraper = await Scraper.build('https://munstats.pa.gov/Reports/ReportInformation2.aspx?report=mAfrForm');
    await scraper.scrapeUnretrievedReports();
    // Wait 3 seconds
    await new Promise(r => setTimeout(r, 3000));
    await scraper.browser.close();
}

module.exports = {scrapeData};