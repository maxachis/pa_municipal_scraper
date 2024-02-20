SELECT
    fr.municipality,
    pd.MUNI_ID,
    fr.county,
    md.POPULATION,
    pd.POLICE_SERVICE_TYPE,
    pd.FULL_TIME_OFFICERS,
    pd.PART_TIME_OFFICERS,
    pd.CONTRACT_TO_OTHERS,
    pd.CONTRACTED_TO_MUNICIPALITIES,
    pd.CONTRACTED_FROM_MUNICIPALITY,
    pd.REGIONAL_NAME,
    pd.REGIONAL_MUNICIPALITIES,
    SUM(CASE WHEN fr.year = 2019 THEN fr.police_expenditures ELSE 0 END) AS police_expenditures_2019,
    SUM(CASE WHEN fr.year = 2019 THEN fr.total_expenditures ELSE 0 END) AS total_expenditures_2019,
    SUM(CASE WHEN fr.year = 2020 THEN fr.police_expenditures ELSE 0 END) AS police_expenditures_2020,
    SUM(CASE WHEN fr.year = 2020 THEN fr.total_expenditures ELSE 0 END) AS total_expenditures_2020,
    SUM(CASE WHEN fr.year = 2021 THEN fr.police_expenditures ELSE 0 END) AS police_expenditures_2021,
    SUM(CASE WHEN fr.year = 2021 THEN fr.total_expenditures ELSE 0 END) AS total_expenditures_2021
FROM FinReportCache fr
LEFT JOIN policeDetails pd ON fr.municipality = pd.MUNICIPALITY_NAME AND fr.county = pd.COUNTY_NAME
LEFT JOIN muniDemo md ON pd.MUNI_ID = md.MUNI_ID
WHERE fr.year IN (2019, 2020, 2021)
GROUP BY fr.municipality, fr.county, pd.MUNI_ID, md.POPULATION, pd.POLICE_SERVICE_TYPE, pd.FULL_TIME_OFFICERS, pd.PART_TIME_OFFICERS, pd.CONTRACT_TO_OTHERS, pd.CONTRACTED_TO_MUNICIPALITIES, pd.CONTRACTED_FROM_MUNICIPALITY, pd.REGIONAL_NAME, pd.REGIONAL_MUNICIPALITIES
ORDER BY fr.county, fr.municipality;