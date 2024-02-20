const DatabaseManager = require("../Common/DatabaseManager");

class MuniDemoDatabaseManager extends DatabaseManager {
    constructor() {
        super();
        const sql = `CREATE TABLE IF NOT EXISTS muniDemo (
            COUNTY_NAME TEXT,
            MUNI_ID TEXT PRIMARY KEY,
            MUNICIPALITY_NAME TEXT,
            POPULATION INTEGER,
            landAreaSqMiles REAL,
            federal_ein_code TEXT,
            home_rule_code TEXT,
            home_rule_name TEXT,
            home_rule_year INTEGER,
            GOVERNMENTAL_FORM TEXT,
            EMPLOYEES_FULL_TIME INTEGER,
            EMPLOYEES_PART_TIME INTEGER,
            INCORPORATION_YEAR INTEGER
        )`;
        this.db.run(sql, function(err) {
            if (err) {
                return console.error(err.message);
            }
    // Table created successfully or already exists
        });
    }

    upsertMuniDemoData(muniDemoData) {
        const sql = `
            INSERT INTO muniDemo (
                COUNTY_NAME, MUNI_ID, MUNICIPALITY_NAME, POPULATION, landAreaSqMiles,
                federal_ein_code, home_rule_code, home_rule_name, home_rule_year, GOVERNMENTAL_FORM,
                EMPLOYEES_FULL_TIME, EMPLOYEES_PART_TIME, INCORPORATION_YEAR
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(MUNI_ID) DO UPDATE SET
                COUNTY_NAME = excluded.COUNTY_NAME,
                MUNICIPALITY_NAME = excluded.MUNICIPALITY_NAME,
                POPULATION = excluded.POPULATION,
                landAreaSqMiles = excluded.landAreaSqMiles,
                federal_ein_code = excluded.federal_ein_code,
                home_rule_code = excluded.home_rule_code,
                home_rule_name = excluded.home_rule_name,
                home_rule_year = excluded.home_rule_year,
                GOVERNMENTAL_FORM = excluded.GOVERNMENTAL_FORM,
                EMPLOYEES_FULL_TIME = excluded.EMPLOYEES_FULL_TIME,
                EMPLOYEES_PART_TIME = excluded.EMPLOYEES_PART_TIME,
                INCORPORATION_YEAR = excluded.INCORPORATION_YEAR
        `;

        this.db.run(sql, [
            muniDemoData.COUNTY_NAME, muniDemoData.MUNI_ID, muniDemoData.MUNICIPALITY_NAME,
            muniDemoData.POPULATION, muniDemoData.landAreaSqMiles, muniDemoData.federal_ein_code,
            muniDemoData.home_rule_code, muniDemoData.home_rule_name, muniDemoData.home_rule_year,
            muniDemoData.GOVERNMENTAL_FORM, muniDemoData.EMPLOYEES_FULL_TIME, muniDemoData.EMPLOYEES_PART_TIME,
            muniDemoData.INCORPORATION_YEAR
        ]);
    }
}


module.exports = MuniDemoDatabaseManager;