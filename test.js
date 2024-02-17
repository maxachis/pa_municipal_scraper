
const url = 'https://munstats.pa.gov/Reports/ReportInformation2.aspx?report=mAfrForm'
const yearSelector = 'select[name="ctl00$ContentPlaceHolder1$ddYear"]';

const downloadPathRoot = process.cwd();
const displayButtonSelector = 'input[id="ContentPlaceHolder1_btnDisplay"]';

const {actionWithRetry, selectOption} = require('./util');




const path = require('path');
const fs = require('fs');
const {scrapeData} = require("./Scraper");
const { prepareCache, resetCache } = require('./CacheManager');


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

// async function prepareCache() {
//     // This function should be called before the main loop to ensure that the cache is prepared
//     // Cache preparation entails:
//     // - Ensuring the database is created (or, if created, truncated)
//     // - Ensuring the table is created
//     // - Iterating through all possible combinations of country, authority, and year,
//     //    and inserting them into the cache with a status of 'NOT_ATTEMPTED'
//     // - Ensuring that the database is closed
//
//     const cache_manager = new CacheManager();
//     cache_manager.createFinReportTable();
//     cache_manager.truncateFinReportTable();
//     const { page, _, browser } = await launchBrowser(url);
//
//     const countyOptions = await getOptions(page, countySelector);
//     let oldAuthorityOptions = await getOptions(page, authoritySelector);
//     for (const countyValue of countyOptions) {
//         if (countyValue === "-1") continue;
//         await selectOption(page, countySelector, countyValue);
//         const countyName = await getSelectedOptionText(page, countySelector);
//         console.log('Selected county:', countyName);
//         let newAuthorityOptions = await getOptions(page, authoritySelector, oldAuthorityOptions);
//         for (const authorityValue of newAuthorityOptions) {
//             if (authorityValue === "-1") continue;
//             await selectOption(page, authoritySelector, authorityValue);
//             const authorityName = await getSelectedOptionText(page, authoritySelector);
//             console.log('Selected authority:', authorityName);
//
//             const yearOptions = await getOptions(page, yearSelector);
//             for (const yearValue of yearOptions) {
//                 if (yearValue === "-1") continue;
//                 cache_manager.cacheFinReportData(countyName, authorityName, yearValue, Status.NOT_ATTEMPTED);
//             }
//         }
//     }
//     await browser.close()
//     cache_manager.close();
//
// }



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
        await scrapeData();
    } else if (command === 'resetCache') {
        await resetCache();
    } else {
        console.error('Invalid command:', command);
        process.exit(1);
    }

})();

