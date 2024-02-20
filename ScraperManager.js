const sqlite3 = require("sqlite3");
const {Scraper} = require("./Scraper");
const fs = require('fs').promises;

class ScraperManager {
    constructor(concurrency = 1) { // Default concurrency level
        this.concurrency = concurrency;
        this.statuses = Array.from({ length: concurrency }, () => 'Idle');
        this.totalEntriesProcessed = 0;
        this.startTime = Date.now();
        this.activeScrapers = [];
        this.dbPath = './scraperCache.db';
        this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error when connecting to the cache database', err.message);
            } else {
                console.log('Connected to the cache database.');
            }
        });
    }

    async init() {
        // Initialize database, clean up old data, etc.
        await this.cleanupBeforeStart();
    }




    updateStatuses(index, status) {
        this.statuses[index] = status;
        const statusLines = this.statuses.map((status, i) => `Scraper ${i}: ${status}`);
        console.clear();
        console.log(statusLines.join('\n'));
        // Additionally log the total entries processed and the average number processed per minute
        console.log(`Total entries processed: ${this.totalEntriesProcessed}`);
        console.log(`Average entries processed per minute: ${this.totalEntriesProcessed / ((Date.now() - this.startTime) / 60000)}`);
    }

    async fetchNextTask() {
        return new Promise((resolve, reject) => {
            // Attempt to atomically select and mark a task as in-process
            const query = `UPDATE FinReportCache SET status = 'IN_PROCESS' 
                       WHERE ROWID = ( 
                           SELECT ROWID FROM FinReportCache 
                           WHERE status IN ('NOT_ATTEMPTED') 
                           ORDER BY county, municipality, year LIMIT 1 
                       ) RETURNING *;`;

            this.db.get(query, (err, row) => {
                if (err) {
                    console.error('Error fetching and updating next task', err.message);
                    return reject(err);
                }
                if (row) {
                    resolve(row); // Successfully fetched and updated a task
                } else {
                    resolve(null); // No task was available to fetch and update
                }
            });
        });
    }


    async updateEntryExpenditures(county, municipality, year, police_expenditures, total_expenditures) {
        return new Promise((resolve, reject) => {
            const query = `UPDATE FinReportCache SET police_expenditures = ?, total_expenditures = ?, status = 'RETRIEVED' 
                       WHERE county = ? AND municipality = ? AND year = ?`;
            this.db.run(query, [police_expenditures, total_expenditures, county, municipality, year], (err) => {
                if (err) {
                    console.error('Error updating cache', err.message);
                    reject(err);
                } else {
                    console.log(`Updated ${county}, ${municipality}, ${year} with police and total expenditures`);
                    resolve();
                }
            });
        });
    }



    async removeOutputsDirectory() {
        try {
            await fs.rm('./Outputs', { recursive: true, force: true });
            console.log('Successfully removed the Outputs directory and its contents');
        } catch (err) {
            console.error('Error while removing the Outputs directory and its contents', err);
        }
    }

    async prepareCache() {
        // Mark all entries that are not 'RETRIEVED' or 'RETRIEVAL_FAILED' as 'NOT_ATTEMPTED'
        this.db.run(`UPDATE FinReportCache SET status = 'NOT_ATTEMPTED' WHERE status not in ('RETRIEVED', 'RETRIEVAL_FAILED')`, (err) => {
            if (err) {
                console.error('Error preparing cache', err.message);
            }
        });
    }

    async cleanupBeforeStart() {
        // Perform any necessary cleanup before starting new scrapers
        // Remove all directories (and contents) in the Outputs directory
        await this.removeOutputsDirectory();
        await this.prepareCache();

    }

    async cleanupAfterCompletion() {
        // Clean up resources after scrapers have completed their tasks
        await this.removeOutputsDirectory();
    }

    async runScrapers() {
        const scrapers = Array.from({ length: this.concurrency }, () => new Scraper());
        const url = 'https://munstats.pa.gov/Reports/ReportInformation2.aspx?report=mAfrForm'
        // Initialize all scrapers and start the scraping process
        const scraperPromises = scrapers.map(async (scraper, index) => {
            const maxRetries = 3; // Maximum number of retries
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    await scraper.build(url, `scraper${index}`); // Pass the index or a unique identifier if needed
                    await this.processTasks(scraper, index);
                    break; // Break out of the for loop if the build was successful
                } catch (error) {
                    console.error(`Error building scraper for index ${index}: ${error}`);
                    if (attempt === maxRetries - 1) { // If the retry limit is reached, throw the error
                        throw error;
                    }
                }
            }
        });

        await Promise.all(scraperPromises);
    }

    async updateEntryStatus(county, municipality, year, status) {
        this.db.run(`UPDATE FinReportCache SET status = ? WHERE county = ? AND municipality = ? AND year = ?`, [status, county, municipality, year], (err) => {
            if (err) {
                console.error('Error updating cache', err.message);
            }
        });
    }

    async processTasks(scraper, index) {
        let selection;
        const maxRetries = 3; // Maximum number of retries

        while (selection = await this.fetchNextTask()) {
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    scraper.updateStatus('Scraping');
                    this.updateStatuses(index, `Scraping ${selection.county}, ${selection.municipality}, ${selection.year}`);
                    const {policeExpenditure, totalExpenditure} = await scraper.scrapeReport(selection);
                    await this.updateEntryExpenditures(selection.county, selection.municipality, selection.year, policeExpenditure, totalExpenditure);
                    scraper.updateStatus('Idle');
                    this.updateStatuses(index, 'Idle');
                    break; // Break out of the for loop if the scrape was successful
                } catch (error) {
                    scraper.logError(`Error scraping report for ${selection.county}, ${selection.municipality}, ${selection.year}: ${error}`);
                    scraper.updateStatus('Error');
                    this.updateStatuses(index, 'Error');
                    if (attempt === maxRetries - 1) { // If the retry limit is reached, update the status to 'RETRIEVAL_FAILED'
                        await this.updateEntryStatus(selection.county, selection.municipality, selection.year, 'RETRIEVAL_FAILED');
                        scraper.updateStatus('Idle');
                        this.updateStatuses(index, 'Idle');
                    }
                }
            }
            this.totalEntriesProcessed++;
        }
    }


    async resetTaskStatus(county, municipality, year, status) {
        return new Promise((resolve, reject) => {
            this.db.run(`UPDATE FinReportCache SET status = ? WHERE county = ? AND municipality = ? AND year = ?`,
                [status, county, municipality, year], (err) => {
                    if (err) {
                        console.error('Error resetting task status', err.message);
                        reject(err);
                    } else {
                        console.log(`Reset status for ${county}, ${municipality}, ${year} to ${status}`);
                        resolve();
                    }
                });
        });
    }


    async scaleScrapers() {
        // Optional: Implement logic to scale the number of scrapers based on resource utilization or other criteria
    }
}

// Create function to run the scraper manager
async function runScraperManager() {
    const manager = new ScraperManager(10);
    await manager.init();
    await manager.runScrapers();
    await manager.cleanupAfterCompletion();
}

// Export
module.exports = {ScraperManager, runScraperManager};