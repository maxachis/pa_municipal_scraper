const DatabaseManager = require("../Common/DatabaseManager");

class PoliceDetailsDatabaseManager extends DatabaseManager {
    constructor() {
        super();
        this.db.run(`CREATE TABLE IF NOT EXISTS policeDetails (
            MUNI_ID TEXT PRIMARY KEY,
            COUNTY_NAME TEXT,
            MUNICIPALITY_NAME TEXT,
            POLICE_SERVICE_TYPE TEXT,
            FULL_TIME_OFFICERS INTEGER,
            PART_TIME_OFFICERS INTEGER,
            CONTRACT_TO_OTHERS TEXT,
            CONTRACTED_TO_MUNICIPALITIES TEXT,
            CONTRACTED_FROM_MUNICIPALITY TEXT,
            REGIONAL_NAME TEXT,
            REGIONAL_MUNICIPALITIES TEXT
        )`);
    }

    insertPoliceDetails(policeDetailsData) {
        const sql = `
            INSERT INTO policeDetails (
                MUNI_ID, COUNTY_NAME, MUNICIPALITY_NAME, POLICE_SERVICE_TYPE, FULL_TIME_OFFICERS,
                PART_TIME_OFFICERS, CONTRACT_TO_OTHERS, CONTRACTED_TO_MUNICIPALITIES,
                CONTRACTED_FROM_MUNICIPALITY, REGIONAL_NAME, REGIONAL_MUNICIPALITIES
            ) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(MUNI_ID) DO UPDATE SET
                COUNTY_NAME = excluded.COUNTY_NAME,
                MUNICIPALITY_NAME = excluded.MUNICIPALITY_NAME,
                POLICE_SERVICE_TYPE = excluded.POLICE_SERVICE_TYPE,
                FULL_TIME_OFFICERS = excluded.FULL_TIME_OFFICERS,
                PART_TIME_OFFICERS = excluded.PART_TIME_OFFICERS,
                CONTRACT_TO_OTHERS = excluded.CONTRACT_TO_OTHERS,
                CONTRACTED_TO_MUNICIPALITIES = excluded.CONTRACTED_TO_MUNICIPALITIES,
                CONTRACTED_FROM_MUNICIPALITY = excluded.CONTRACTED_FROM_MUNICIPALITY,
                REGIONAL_NAME = excluded.REGIONAL_NAME,
                REGIONAL_MUNICIPALITIES = excluded.REGIONAL_MUNICIPALITIES
        `;

        this.db.run(sql, [
            policeDetailsData.MUNI_ID, policeDetailsData.county, policeDetailsData.municipality,
            policeDetailsData.policeServiceType, policeDetailsData.fullTimeOfficers,
            policeDetailsData.partTimeOfficers, policeDetailsData.contractToOthers,
            policeDetailsData.contractedToMunicipalities, policeDetailsData.contractedFromMunicipality,
            policeDetailsData.regionalName, policeDetailsData.regionalMunicipalities
        ]);
    }
}

module.exports = PoliceDetailsDatabaseManager;