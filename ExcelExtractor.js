
/*
    Excel Extractor Class
    Extracts relevant information from an excel file
 */

const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

// Enum indicating the number of the sheet to be extracted
const SHEET = {
    BALANCE: 2,
    REVENUES_AND_EXPENDITURES: 3,
    DEBT: 4,
    CAPITAL_EXPENDITURES: 5
};

class ExcelExtractor {
    constructor() {
        this.workbook = null;
        this.sheet = null;
    }

    loadWorkbook(filePath) {
        this.workbook = xlsx.readFile(filePath);
    }

    loadSheet(sheetName) {
        this.sheet = this.workbook.Sheets[`Sheet${sheetName}`];
    }

    getCellValue(cellName) {
        try {
            return this.sheet[cellName].v;
        }
        catch (e) {
            return null;
        }
    }

    getCellRange(range) {
        return xlsx.utils.decode_range(range);
    }

    findRowInColumnWithText(column, text) {
        const range = this.getCellRange(this.sheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            // Console log the cell name and the value of the cell
            const cellName = `${column}${R}`;
            const cellValue = this.getCellValue(cellName);
            console.log(cellName, cellValue);
            if (cellValue !== null && cellValue.trim() === text) {
                return R;
            }
        }
        return null;
    }

    getPoliceAndTotalExpenditures() {
        this.loadSheet(SHEET.REVENUES_AND_EXPENDITURES);
        const ExpenditureNameColumn = "B";
        const ExpenditureValueColumn = "J";
        const policeRow = this.findRowInColumnWithText(ExpenditureNameColumn, "Police");
        const policeExpenditure = this.getCellValue(`${ExpenditureValueColumn}${policeRow}`);

        const totalRow = this.findRowInColumnWithText(ExpenditureNameColumn, "TOTAL EXPENDITURES");
        const totalExpenditure = this.getCellValue(`${ExpenditureValueColumn}${totalRow}`);

        return { policeExpenditure, totalExpenditure };
    }
}

// Main
const extractor = new ExcelExtractor();
// Load file from Temp directory using relative address
const filePath = path.join(__dirname, 'Temp', 'mAfrForm.xlsx');
extractor.loadWorkbook(filePath);
console.log(extractor.getPoliceAndTotalExpenditures())
