// import {ExcelExtractor} from "./Scripts/Common/ExcelExtractor";
const ExcelExtractor = require('../Common/ExcelExtractor');
// import {PoliceDetailsData} from "./Scripts/PoliceDetailsScraper/PoliceDetailsObject";
const PoliceDetailsData = require('./PoliceDetailsObject');
const PoliceDetailsDatabaseManager = require("./PoliceDetailsDatabaseManager");

const columns = {
    "COUNTY_NAME": "A",
    "MUNI_ID": "B",
    "MUNICIPALITY_NAME": "C",
    "POLICE_SERVICE_TYPE": "D",
    "FULL_TIME_OFFICERS": "E",
    "PART_TIME_OFFICERS": "F",
    "CONTRACT_TO_OTHERS": "G",
    "CONTRACTED_TO_MUNICIPALITIES": "H",
    "CONTRACTED_FROM_MUNICIPALITY": "I",
    "REGIONAL_NAME": "J",
    "REGIONAL_MUNICIPALITIES": "K"
}

const excelPath = `${process.cwd()}\\Scripts\\PoliceDetailsScraper\\MuniPolice_Excel.xlsx`;

class PoliceDetailsExtractor extends ExcelExtractor {
    constructor() {
        super();
        this.databaseManager = new PoliceDetailsDatabaseManager();

        this.loadWorkbook(excelPath);
    }

    // Method for putting all rows in the database
    putAllDataInDatabase() {
        this.loadSheet('MuniPolice_Excel');
        const range = this.getCellRange(this.sheet['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
            const policeDetailsObject = new PoliceDetailsData();
            policeDetailsObject.MUNI_ID = this.getCellValue(`${columns.MUNI_ID}${R}`);
            policeDetailsObject.county = this.getCellValue(`${columns.COUNTY_NAME}${R}`);
            policeDetailsObject.municipality = this.getCellValue(`${columns.MUNICIPALITY_NAME}${R}`);
            policeDetailsObject.policeServiceType = this.getCellValue(`${columns.POLICE_SERVICE_TYPE}${R}`);
            policeDetailsObject.fullTimeOfficers = this.getCellValue(`${columns.FULL_TIME_OFFICERS}${R}`);
            policeDetailsObject.partTimeOfficers = this.getCellValue(`${columns.PART_TIME_OFFICERS}${R}`);
            policeDetailsObject.contractToOthers = this.getCellValue(`${columns.CONTRACT_TO_OTHERS}${R}`);
            policeDetailsObject.contractedToMunicipalities = this.getCellValue(`${columns.CONTRACTED_TO_MUNICIPALITIES}${R}`);
            policeDetailsObject.contractedFromMunicipality = this.getCellValue(`${columns.CONTRACTED_FROM_MUNICIPALITY}${R}`);
            policeDetailsObject.regionalName = this.getCellValue(`${columns.REGIONAL_NAME}${R}`);
            policeDetailsObject.regionalMunicipalities = this.getCellValue(`${columns.REGIONAL_MUNICIPALITIES}${R}`);
            this.databaseManager.insertPoliceDetails(policeDetailsObject);
        }
    }
}

// Function to extract police details
function extractPoliceDetails() {
    const policeDetailsExtractor = new PoliceDetailsExtractor();
    policeDetailsExtractor.putAllDataInDatabase();
}

module.exports = extractPoliceDetails;