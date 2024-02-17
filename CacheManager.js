
const {launchBrowser, getOptions, Status, selectOption,
    getSelectedOptionText, finReportSelectors, municipalitySelector} = require("./util");
const sqlite3 = require('sqlite3').verbose();


class CacheManager {
    /*
    The nature of the Municipal Statistics website is that it takes substantial time
    to iterate through all the reports and download them.
    In order to avoid having to re-download the reports every time the script is run,
    as well as to avoid having to re-run some data in case of a crash,
    this class implements a cache system that will
    store the downloaded reports in a local, SQLLite database.
     */

    constructor() {
        // Connect to SQLite database
        this.db = new sqlite3.Database('./scraperCache.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error when connecting to the cache database', err.message);
            } else {
                console.log('Connected to the cache database.');
            }
        });
        this.cacheFinReportData = this.cacheFinReportData.bind(this);
    }

    createFinReportTable() {
        this.db.run(`CREATE TABLE IF NOT EXISTS FinReportCache (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              county TEXT,
              municipality TEXT,
              year INTEGER,
              download_url TEXT,
              police_expenditures REAL,
              total_expenditures REAL,
              status TEXT CHECK( status IN ('RETRIEVED','RETRIEVAL_FAILED','UNAVAILABLE', 'NOT_ATTEMPTED', 'IN_PROCESS') ),
              UNIQUE(county, municipality, year)  -- Ensures uniqueness for each entry
            )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            } else {
                console.log('Table is created or already exists.');
            }
        });
    }

    deleteFinReportTable() {
        this.db.run(`DROP TABLE IF EXISTS FinReportCache`, (err) => {
            if (err) {
                console.error('Error dropping table', err.message);
            } else {
                console.log('Table is dropped.');
            }
        });
}

    validateFinReportData() {
        // Check if data is valid. Valid conditions include:
        // - Each municipality is associated with only one county
        // - Each municipality has the same number of years of data

        // TODO: Complete
    };

    cacheFinReportData(county, municipality, year, status) {
        // Prepared statement to insert or replace based on unique constraint, using the 'status' column
        let stmt = this.db.prepare(`INSERT INTO FinReportCache (county, municipality, year, status) VALUES(?, ?, ?, ?)
                         ON CONFLICT(county, municipality, year) DO UPDATE SET status = excluded.status`);

        stmt.run(county, municipality, year, status, function(err) {
            if (err) {
                return console.error('Error inserting data into cache', err.message);
            }
            console.log(`Inserted row with rowid ${this.lastID} and values ${county}, ${municipality}, ${year}, ${status}`);
        });

        stmt.finalize();
    };

    checkFinReportEntry(county, municipality, year) {
        this.db.get(`SELECT * FROM FinReportCache WHERE county = ? AND municipality = ? AND year = ?`, [county, municipality, year], (err, row) => {
            if (err) {
                console.error('Error querying cache', err.message);
            }
            if (row) {
                console.log('Entry found:', row);
                return true;
            } else {
                console.log('No entry found.');
                return false;
            }
        });
    };

    checkFinReportmunicipality(county, municipality) {
        // Check if there
    };


    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error when closing the database', err.message);
            } else {
                console.log('Close the database connection.');
            }
        });
    }
}

async function getAndFilterOptions(page, selector, additionalArgs = {}, filterValue = "-1") {
    // If additionalArgs are provided for this selector, handle them accordingly
    const options = additionalArgs.oldmunicipalityOptions && selector === municipalitySelector
        ? await getOptions(page, selector, additionalArgs.oldmunicipalityOptions)
        : await getOptions(page, selector);
    return options.filter(option => option !== filterValue);
}

async function selectOptionAndCache(page, selections, cacheFunction) {
    const { countyName, municipalityName, yearName } = selections;
    if (countyName && municipalityName && yearName) {
        cacheFunction(countyName, municipalityName, yearName, Status.NOT_ATTEMPTED);
    }
}

async function processSelections(page, selectors, cacheFunction, selections = {}, index = 0, additionalArgs = {oldMunicipalityOptions: ''}) {
    if (index >= selectors.length) {
        await selectOptionAndCache(page, selections, cacheFunction);
        return;
    }

    const { selector, type } = selectors[index];
    const options = await getAndFilterOptions(page, selector, additionalArgs);

    for (const value of options) {
        await selectOption(page, selector, value);
        const name = await getSelectedOptionText(page, selector);
        if (name === "[Select a Value]") continue
        console.log(`Selected ${type}:`, name);

        // Prepare additional arguments for the next level, if any
        let nextAdditionalArgs = {};
        if (type === 'county') {
            // Assume getOptions for municipalitySelector needs oldMunicipalityOptions which we just fetched
            nextAdditionalArgs.oldMunicipalityOptions = options;
        }

        await processSelections(page, selectors, cacheFunction, { ...selections, [`${type}Name`]: name }, index + 1, nextAdditionalArgs);
    }
}


async function processAllOptions(page, cache_manager) {
    await processSelections(page, finReportSelectors, cache_manager.cacheFinReportData);
}



async function prepareCache(url) {
    // This function should be called before the main loop to ensure that the cache is prepared
    // Cache preparation entails:
    // - Ensuring the database is created (or, if created, truncated)
    // - Ensuring the table is created
    // - Iterating through all possible combinations of country, municipality, and year,
    //    and inserting them into the cache with a status of 'NOT_ATTEMPTED'
    // - Ensuring that the database is closed
    const cache_manager = new CacheManager();
    cache_manager.deleteFinReportTable();
    cache_manager.createFinReportTable();
    const { page, _, browser } = await launchBrowser(url);
    await processAllOptions(page, cache_manager).catch(console.error);
    await browser.close()
    cache_manager.close();
}

module.exports = { CacheManager, prepareCache }
