class PoliceDetailsData {
    constructor() {
        this.MUNI_ID = undefined; // Column B
        this.county = undefined; // Column A
        this.municipality = undefined; // Column C
        this.policeServiceType = undefined; // Column D
        this.fullTimeOfficers = undefined; // E
        this.partTimeOfficers = undefined; //
        this.contractToOthers = undefined;
        this.contractedToMunicipalities = undefined;
        this.contractedFromMunicipality = undefined;
        this.regionalName = undefined;
        this.regionalMunicipalities = undefined;
    }
}

module.exports = PoliceDetailsData;