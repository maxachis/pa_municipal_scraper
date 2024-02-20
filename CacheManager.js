
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

    resetCache() {
        // Reset the cache by dropping the table and creating a new one
        this.deleteFinReportTable();
        this.createFinReportTable();
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


    deleteUnretrievedReports() {
            this.db.run(`DELETE FROM FinReportCache WHERE status in ('NOT_ATTEMPTED', 'RETRIEVAL_FAILED')`, (err) => {
                if (err) {
                    console.error('Error deleting unretrieved reports', err.message);
                } else {
                    console.log('Unretrieved reports deleted.');
                }
            });
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
              last_updated DATETIME,
              UNIQUE(county, municipality, year)  -- Ensures uniqueness for each entry
            )`, (err) => {
            if (err) {
                console.error('Error creating table', err.message);
            } else {
                console.log('Table is created or already exists.');
            }
        });
        // Create triggers
        this.db.run(`CREATE TRIGGER update_fin_report_last_updated
            AFTER UPDATE ON FinReportCache
            FOR EACH ROW
            BEGIN
                UPDATE FinReportCache SET last_updated = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;`, (err) => {
            if (err) {
                console.error('Error creating trigger', err.message);
            } else {
                console.log('Trigger is created or already exists.');
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
        // Check if the entry already exists in the database
        this.db.get(`SELECT * FROM FinReportCache WHERE county = ? AND municipality = ? AND year = ?`, [county, municipality, year], (err, row) => {
            if (err) {
                return console.error('Error querying the database', err.message);
            }
            // If the entry exists, log a message and return immediately
            if (row) {
                return console.log(`Entry with county ${county}, municipality ${municipality}, and year ${year} already exists.`);
            }
        });

        // If the entry does not exist, proceed with the insertion
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

async function getAndFilterOptions(page, selector, filterValue = "-1") {
    // If additionalArgs are provided for this selector, handle them accordingly
    const options = await getOptions(page, selector);
    return options.filter(option => option !== filterValue);
}

async function processFinReportSelections(page, cacheFunction) {
    // Year options are the same for all counties and municipalities
    const yearOptions = await getAndFilterOptions(page, finReportSelectors[2].selector);
    const countyOptions = await getAndFilterOptions(page, finReportSelectors[0].selector);
    for (const countyValue of countyOptions) {
        // Get old municipality options to pass to the next level
        let oldMunicipalityOptions = await getAndFilterOptions(page, municipalitySelector);
        await selectOption(page, finReportSelectors[0].selector, countyValue);
        const countyName = await getSelectedOptionText(page, finReportSelectors[0].selector);
        console.log('Selected county:', countyName);
        // Get new municipality options to pass to the next level. If they are the same as the old ones, repeat until this is not the case
        let newMunicipalityOptions;
        do {
            newMunicipalityOptions = await getAndFilterOptions(page, municipalitySelector);
            // console.log('New municipality options:', JSON.stringify(newMunicipalityOptions));
            // console.log('Old municipality options:', JSON.stringify(oldMunicipalityOptions));
        } while (JSON.stringify(oldMunicipalityOptions) === JSON.stringify(newMunicipalityOptions));

        for (const municipalityValue of newMunicipalityOptions) {
            await selectOption(page, municipalitySelector, municipalityValue);
            const municipalityName = await getSelectedOptionText(page, municipalitySelector);
            console.log('Selected municipality:', municipalityName);
            for (const yearValue of yearOptions) {
                cacheFunction(countyName, municipalityName, yearValue, Status.NOT_ATTEMPTED);
            }
        }
    }
}

async function processAllOptions(page, cache_manager) {
    await processFinReportSelections(page, cache_manager.cacheFinReportData);
    // await processSelections(page, finReportSelectors, cache_manager.cacheFinReportData);
}


async function resetCache() {
    // Cache reset entails:
    // - Dropping the table
    // - Creating a new table

    const cache_manager = new CacheManager();
    cache_manager.resetCache();
    cache_manager.close();
}

async function prepareCache(url) {
    // This function should be called before the main loop to ensure that the cache is prepared
    // Cache preparation entails:
    // - Iterating through all possible combinations of country, municipality, and year not already in the cache,
    //    and inserting them into the cache with a status of 'NOT_ATTEMPTED'
    // - Ensuring that the database is closed
    const cache_manager = new CacheManager();
    cache_manager.deleteUnretrievedReports();
    const { page, _, browser } = await launchBrowser(url);
    await processAllOptions(page, cache_manager).catch(console.error);
    await browser.close()
    cache_manager.close();
}

module.exports = { CacheManager, prepareCache, resetCache }
