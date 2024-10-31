
const url = 'https://munstats.pa.gov/Reports/ReportInformation2.aspx?report=mAfrForm'
const yearSelector = 'select[name="ctl00$ContentPlaceHolder1$ddYear"]';

const downloadPathRoot = process.cwd();
const displayButtonSelector = 'input[id="ContentPlaceHolder1_btnDisplay"]';

const {actionWithRetry, selectOption} = require('./util');
const {runScraperManager} = require("./ScraperManager");




const path = require('path');
const fs = require('fs');
const {scrapeData} = require("./Scraper");
const { prepareCache, resetCache } = require('./CacheManager');
const extractPoliceDetails = require("./Scripts/PoliceDetailsScraper/PoliceDetailsExtractor");
const extractMuniDemoData = require("./Scripts/MuniDemographicsScraper/MuniDemoExtractor");


function xlsxExists(directory) {
    const files = fs.readdirSync(directory);
    return files.some(file => path.extname(file) === '.xlsx');
}


function ensureDirectoryExists(directoryPath) {
    try {
        fs.mkdirSync(directoryPath, { recursive: true });
        console.log(`Directory ensured: ${directoryPath}`);
    } catch (error) {
        console.error(`Error ensuring directory: ${error}`);
        throw error; // Rethrow if you need to handle it further up
    }
}






async function downloadReport(page, client, countyName, authorityName, yearValue) {
    const downloadPath = `\\Outputs\\${countyName}\\${authorityName}\\${yearValue}`.replace(/[<>:"/|?*.]/g, '_');
    await ensureDirectoryExists('.' + downloadPath);
    if (xlsxExists(downloadPathRoot + downloadPath)) {
        console.log('XLSX already exists for ' + countyName + ' ' + authorityName + ' ' + yearValue + ', skipping download');
        return;
    }

    console.log('Attempting to retrieve report for year ' + yearValue)
    await selectOption(page, yearSelector, yearValue);
    await clickDisplayReportButton(page);

    await page.waitForFunction((selector) => {
        const btn = document.querySelector(selector);
        return btn.value === 'Display Report' && !btn.disabled;
    }, { polling: 'mutation' }, displayButtonSelector);

    await actionWithRetry(async () => {
        const isErrorPresent = await checkIfErrorPresent(page);
        if (isErrorPresent) {
            console.log('Error message detected, not proceeding with exportReport.');
            return;
        }

        await ensureDirectoryExists('.' + downloadPath);
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPathRoot + downloadPath
        });
        console.log("Download path set to " + downloadPathRoot + downloadPath);
        await page.evaluate(() => {
            console.log("Proceeding with export")
            $find('ctl00_ContentPlaceHolder1_rvReport').exportReport('EXCELOPENXML');
        });
    });
}

// TODO: Modify so that these functions are all part of a single class so that certain resources (eg, db, browser)
//  can be shared

(async () => {
    // Access the command line arguments
    const args = process.argv.slice(2); // Slice the first two elements
    if (args.length === 0) {
        console.error('Usage: node test.js [prepareCache|scrapeData]');
        process.exit(1);
    }
    const command = args[0];
    if (command === 'prepareCache') {
        await prepareCache(url);
    } else if (command === 'scrapeData') {
        await runScraperManager();
    } else if (command === 'resetCache') {
        await resetCache();
    } else if (command === 'extractPoliceDetails') {
        await extractPoliceDetails();
    } else if (command === 'extractMuniDemoData'){
        await extractMuniDemoData();
    } else {
        console.error('Invalid command:', command);
        process.exit(1);
    }

})();

