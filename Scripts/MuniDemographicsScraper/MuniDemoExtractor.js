const ExcelExtractor = require('../Common/ExcelExtractor');
const MuniDemoObject = require('./MuniDemoObject');
const MuniDemoDatabaseManager = require("./MuniDemoDatabaseManager");

const columns = {
    "COUNTY_NAME": "A",
    "MUNI_ID": "B",
    "MUNICIPALITY_NAME": "C",
    "POPULATION": "D",
    "landAreaSqMiles": "E",
    "federal_ein_code": "F",
    "home_rule_code": "G",
    "home_rule_name": "H",
    "home_rule_year": "I",
    "GOVERNMENTAL_FORM": "J",
    "EMPLOYEES_FULL_TIME": "K",
    "EMPLOYEES_PART_TIME": "L",
    "INCORPORATION_YEAR": "M"
};

const excelPath = `${process.cwd()}\\Scripts\\MuniDemographicsScraper\\CountyMuniDemo_Excel.xlsx`;

class MuniDemoExtractor extends ExcelExtractor {
    constructor() {
        super();
        this.databaseManager = new MuniDemoDatabaseManager();

        this.loadWorkbook(excelPath);
    }

    // Method for putting all rows in the database
    putAllDataInDatabase() {
        this.loadSheet('CountyMuniDemo_Excel');
        const range = this.getCellRange(this.sheet['!ref']);
        for (let R = range.s.r + 1; R <= range.e.r; R++) {
            const muniDemoObject = new MuniDemoObject();
            muniDemoObject.MUNI_ID = this.getCellValue(`${columns.MUNI_ID}${R}`);
            muniDemoObject.COUNTY_NAME = this.getCellValue(`${columns.COUNTY_NAME}${R}`);
            muniDemoObject.MUNICIPALITY_NAME = this.getCellValue(`${columns.MUNICIPALITY_NAME}${R}`);
            muniDemoObject.POPULATION = this.getCellValue(`${columns.POPULATION}${R}`);
            muniDemoObject.landAreaSqMiles = this.getCellValue(`${columns.landAreaSqMiles}${R}`);
            muniDemoObject.federal_ein_code = this.getCellValue(`${columns.federal_ein_code}${R}`);
            muniDemoObject.home_rule_code = this.getCellValue(`${columns.home_rule_code}${R}`);
            muniDemoObject.home_rule_name = this.getCellValue(`${columns.home_rule_name}${R}`);
            muniDemoObject.home_rule_year = this.getCellValue(`${columns.home_rule_year}${R}`);
            muniDemoObject.GOVERNMENTAL_FORM = this.getCellValue(`${columns.GOVERNMENTAL_FORM}${R}`);
            muniDemoObject.EMPLOYEES_FULL_TIME = this.getCellValue(`${columns.EMPLOYEES_FULL_TIME}${R}`);
            muniDemoObject.EMPLOYEES_PART_TIME = this.getCellValue(`${columns.EMPLOYEES_PART_TIME}${R}`);
            muniDemoObject.INCORPORATION_YEAR = this.getCellValue(`${columns.INCORPORATION_YEAR}${R}`);
            this.databaseManager.upsertMuniDemoData(muniDemoObject);
        }
    }
}

// Function to extract muni demo data
function extractMuniDemoData() {
    const muniDemoExtractor = new MuniDemoExtractor();
    muniDemoExtractor.putAllDataInDatabase();
}

module.exports = extractMuniDemoData;