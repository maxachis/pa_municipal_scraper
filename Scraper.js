

const {launchBrowser, actionWithRetry, finReportSelectors} = require("./util");
const sqlite3 = require("sqlite3");
const displayButtonSelector = 'input[id="ContentPlaceHolder1_btnDisplay"]';
const errorSpanSelector = 'span[id="ContentPlaceHolder1_lblError"]';
const errorMessage = "This report is not available at this time"


class Scraper {

    constructor() {
        this.page = null;
        this.client = null;
        this.browser = null;
        this.db = null;
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

        return scraper;
    }

    async getUnretrievedSelections() {
        // Get all the unretrieved selections from the database
        return this.db.all(`SELECT county, municipality, year 
            FROM FinReportCache WHERE status in ('NOT_ATTEMPTED', 'RETRIEVAL_FAILED')
            ORDER BY county, municipality, year`,
            (err, rows) => {
                if (err) {
                    console.error('Error getting unretrieved selections', err.message);
                }
                return rows;
            });
    }

    async scrapeUnretrievedReports() {
        // Scrape all the unretrieved reports
        const unretrievedSelections = await new Promise((resolve, reject) => {
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

        for (const selection of unretrievedSelections) {
            await this.scrapeReport(selection);
        }
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


    async getDownloadUrl() {
        // Get the download URL for the report
        return await this.page.evaluate(() => {
            const baseUrl = 'https://munstats.pa.gov';
            const exportUrlBase = $find('ctl00_ContentPlaceHolder1_rvReport')._getInternalViewer().ExportUrlBase;
            const format = encodeURIComponent("EXCELOPENXML");
            return baseUrl + exportUrlBase + format;
        });
    }

    async  checkIfErrorPresent(page) {
        return await page.evaluate((selector, errorMessage) => {
            const errorElement = document.querySelector(selector);
            // Check if the error element exists and contains the specific error message
            return errorElement && errorElement.textContent.includes(errorMessage);
        }, errorSpanSelector, errorMessage);
    }

    async scrapeReport(selection) {
        for (const {selector, type} of finReportSelectors) {
            await this.selectOptionByText(selector, selection[type]);
        }
        await this.clickDisplayReportButton(this.page);
        await this.page.waitForFunction((selector) => {
            const btn = document.querySelector(selector);
            return btn.value === 'Display Report' && !btn.disabled;
        }, { polling: 'mutation' }, displayButtonSelector);
        await actionWithRetry(async () => {
            const isErrorPresent = await this.checkIfErrorPresent(this.page);
            if (isErrorPresent) {
                console.log('Error message detected, not proceeding with exportReport.');
                await this.updateEntryStatus(selection.county, selection.municipality, selection.year, 'RETRIEVAL_FAILED');
                return;
            }
            const downloadUrl = await this.getDownloadUrl();
            await this.updateEntryDownloadUrl(selection.county, selection.municipality, selection.year, downloadUrl);
        });
    }

    async updateEntryStatus(county, municipality, year, status) {
        this.db.run(`UPDATE FinReportCache SET status = ? WHERE county = ? AND municipality = ? AND year = ?`, [status, county, municipality, year], (err) => {
            if (err) {
                console.error('Error updating cache', err.message);
            }
        });
    }

    async updateEntryDownloadUrl(county, municipality, year, downloadUrl) {
        this.db.run(`UPDATE FinReportCache SET download_url = ?, status='RETRIEVED'
            WHERE county = ? AND municipality = ? AND year = ?`,
            [downloadUrl, county, municipality, year], (err) => {
            if (err) {
                console.error('Error updating cache', err.message);
            }
        });
    }

    async clickDisplayReportButton(page) {
        console.log("Attempting to click Display Report button")
        await actionWithRetry(async () => {
            await page.waitForFunction((selector) => {
                const element = document.querySelector(selector);
                return element && !element.disabled && element.offsetParent !== null;
            }, {}, displayButtonSelector);

            await Promise.all([
                page.click(displayButtonSelector, {waitUntil: 'networkidle2'}),
            ]);
        });
        console.log('Clicked Display Report button')
    }
}

async function scrapeData() {
    const scraper = await Scraper.build('https://munstats.pa.gov/Reports/ReportInformation2.aspx?report=mAfrForm');
    await scraper.scrapeUnretrievedReports();
    await scraper.browser.close();
}

module.exports = {scrapeData};