const xlsx = require("xlsx");

class ExcelExtractor {
    constructor() {
        this.workbook = null;
        this.sheet = null;
    }

    loadWorkbook(filePath) {
        this.workbook = xlsx.readFile(filePath);
    }

    loadSheet(sheetName) {
        this.sheet = this.workbook.Sheets[sheetName];
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
            const cellName = `${column}${R}`;
            const cellValue = this.getCellValue(cellName);
            if (cellValue !== null && cellValue.trim() === text) {
                return R;
            }
        }
        return null;
    }

    findRowMatchingAllPairs(columnTextPairs) {
        const range = this.getCellRange(this.sheet['!ref']);
        for (let R = range.s.r; R <= range.e.r; R++) {
            let allPairsMatch = true;
            for (let pair of columnTextPairs) {
                const cellName = `${pair.column}${R}`;
                const cellValue = this.getCellValue(cellName);
                if (cellValue === null || cellValue.trim() !== pair.text) {
                    allPairsMatch = false;
                    break;
                }
            }
            if (allPairsMatch) {
                return R;
            }
        }
        return null;
}
}

// Export
module.exports = ExcelExtractor;