
/*
    This file is responsible for managing the database connection and queries.

 */
const sqlite3 = require("sqlite3");

class DatabaseManager {
    constructor() {
        this.db = new sqlite3.Database('./scraperCache.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error('Error when connecting to the cache database', err.message);
            } else {
                console.log('Connected to the cache database.');
            }
        });
    }

    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error when closing the database connection', err.message);
            } else {
                console.log('Close the database connection.');
            }
        });
    }
}

module.exports = DatabaseManager;