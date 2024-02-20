
const {launchBrowser, actionWithRetry, finReportSelectors} = require("./util");
const sqlite3 = require("sqlite3");
const fs = require("fs");
const ExcelExtractor = require("./ExcelExtractor");
const uuid = require("uuid");
const displayButtonSelector = 'input[id="ContentPlaceHolder1_btnDisplay"]';
const errorSpanSelector = 'span[id="ContentPlaceHolder1_lblError"]';
const errorMessage = "This report is not available at this time"
const reportChildSelector = 'div[id="VisibleReportContentctl00_ContentPlaceHolder1_rvReport_ctl09"] > div';

class Scraper {

    constructor() {
        this.identifier = null;
        this.status = 'Idle';
        this.page = null;
        this.client = null;
        this.browser = null;
        this.db = null;
        this.excel_extractor = null;
        // Use the identifier to create a unique download path for each instance

    }

    // Static async factory method
    async build(url, identifier = uuid.v4()) {
        this.identifier = identifier;
        this.downloadPath = `${process.cwd()}\\Outputs\\${this.identifier}`;
        this.logFilePath = `${process.cwd()}\\ErrorLogs\\${this.identifier}.txt`;
        fs.writeFile(this.logFilePath, '', err => {
            if (err) {
                console.error('Failed to clear log file:', err);
            }
        });
        this.excelPath = `${this.downloadPath}\\mAfrForm.xlsx`;
        this.db = new sqlite3.Database('./scraperCache.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error when connecting to the cache database', err.message);
            } else {
                console.log('Connected to the cache database.');
            }
        });
        this.excel_extractor = new MuniFinExtractor();
        await this.ensureDirectoryExists(this.downloadPath);
        await this.ensureDirectoryExists(`${process.cwd()}\\ErrorLogs`);
        const {page, client, browser} = await launchBrowser(url, true, this.logError.bind(this));
        this.page = page;
        this.client = client;
        this.browser = browser;
        await this.setupDownloadDirectory(client);
    }

    logError(message) {
        fs.appendFile(this.logFilePath, message + '\n', err => {
            if (err) {
                console.error('Failed to write to log file:', err);
            }
        });
    }

    async setupDownloadDirectory(client) {
        client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.downloadPath
        });
    }

    updateStatus(newStatus) {
        this.status = newStatus;
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

    waitForFileDownload(filePath, timeout = 30000) {
    let prevFileSize = 0;
    let retries = timeout / 1000; // Check every second
    // console.log('Waiting for file download at ', filePath)

    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
        fs.stat(filePath, (err, stats) => {
            if (err) {
                this.logError(`An error occurred while checking the file stats: ${err}`);
                if (err.code === 'ENOENT' && retries > 0) {
                    this.logError('File not found, waiting and trying again');
                    retries--;
                    return;
                }
                this.logError('Stopping due to an error');
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
                const option = Array.from(select.options).find(opt => opt.text === text.toString());
                return { value: option ? option.value : null, options };
            }, selector, text);
            if (value !== null) {
                await this.page.select(selector, value);
            } else {
                throw new Error(`Option with text "${text}" not found for selector "${selector}". Available options are: ${options.join(', ')}`);
            }
        }, ['not found for selector'],
            6);
    }


    async  checkIfErrorPresent(page) {
        return await page.evaluate((selector, errorMessage) => {
            const errorElement = document.querySelector(selector);
            // Check if the error element exists and contains the specific error message
            return errorElement && errorElement.textContent.includes(errorMessage);
        }, errorSpanSelector, errorMessage);
    }

    async downloadReport() {
        try {
            await actionWithRetry(async () => {
                await this.page.evaluate(() => {
                    $find('ctl00_ContentPlaceHolder1_rvReport').exportReport('EXCELOPENXML');
                });
            });
        } catch (error) {
            this.logError(`Error in downloadReport: ${error}`);
            throw error;
        }
    }

    async deleteFile(filePath) {
        if (fs.existsSync(filePath))
            fs.unlinkSync(filePath);
    }

    async scrapeReport(selection) {
        // console.log(`${this.identifier}:  Scraping report for ${selection.county}, ${selection.municipality}, ${selection.year}`)
        for (const {selector, type} of finReportSelectors) {
            await this.selectOptionByText(selector, selection[type]);
        }
        await this.clickDisplayReportButton(this.page);
        await this.waitForDisplayReportButtonToBeReEnabled();
        // Wait for report child to be present
        await this.page.waitForSelector(reportChildSelector, {timeout: 120000});
        // const url = await this.getDownloadUrl()
        // await this.downloadByUrl(url);
        await this.downloadReport();

        await this.waitForFileDownload(this.excelPath, 3000);
        // console.log('Downloaded file')
        this.excel_extractor.loadWorkbook(this.excelPath);
        // Obtain police and total expenditures
        const {policeExpenditure, totalExpenditure} = this.excel_extractor.getPoliceAndTotalExpenditures()
        await this.deleteFile(this.excelPath);
        // Return the police and total expenditures
        return {policeExpenditure, totalExpenditure}
    }

    async waitForDisplayReportButtonToBeReEnabled() {
        await this.page.waitForFunction((selector) => {
            const btn = document.querySelector(selector);
            return btn.value === 'Display Report' && !btn.disabled;
        }, {polling: 'mutation'}, displayButtonSelector);
    }





    async clickDisplayReportButton(page) {
        await actionWithRetry(async () => {
            await page.waitForFunction((selector) => {
                const element = document.querySelector(selector);
                return element && !element.disabled && element.offsetParent !== null;
            }, {}, displayButtonSelector);

            await Promise.all([
                page.click(displayButtonSelector, {waitUntil: 'networkidle2'}),
            ]);
        });
    }
}



module.exports = {Scraper};