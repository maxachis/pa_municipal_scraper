const ExcelExtractor = require('./Scripts/Common/ExcelExtractor');
/*
    Excel Extractor Class
    Extracts relevant information from an excel file
 */

const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// Enum indicating the number of the sheet to be extracted
const SHEET = {
    BALANCE: 'Sheet2',
    REVENUES_AND_EXPENDITURES: 'Sheet3',
    DEBT: 'Sheet4',
    CAPITAL_EXPENDITURES: 'Sheet5'
};

class MuniFinExtractor extends ExcelExtractor {
    getPoliceAndTotalExpenditures() {
        this.loadSheet(SHEET.REVENUES_AND_EXPENDITURES);
        const ExpenditureCodeColumn = "A";
        const ExpenditureNameColumn = "B"
        const ExpenditureValueColumn = "J";
        const policeRow = this.findRowInColumnWithText(ExpenditureCodeColumn, "410.00");
        const policeExpenditure = this.getCellValue(`${ExpenditureValueColumn}${policeRow}`);

        const totalRow = this.findRowInColumnWithText(ExpenditureNameColumn, "TOTAL EXPENDITURES");
        const totalExpenditure = this.getCellValue(`${ExpenditureValueColumn}${totalRow}`);

        return { policeExpenditure, totalExpenditure };
    }
}
// Main
// const extractor = new MuniFinExtractor();
// // Load file from Temp directory using relative address
// const filePath = path.join(__dirname, 'Outputs', 'mAfrForm.xlsx');
// extractor.loadWorkbook(filePath);
// console.log(extractor.getPoliceAndTotalExpenditures())

// Export
module.exports = MuniFinExtractor;