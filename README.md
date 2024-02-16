This script will be used to pull data from the [Pennsylvania Municipal Statistics Website](https://munstats.pa.gov), per the request in https://github.com/Police-Data-Accessibility-Project/scrapers/issues/240 .

Currently, the following files exist:

* CacheManager.js: A class that manages the cache for the scraper. It is used to store and retrieve data from the cache.
* ExcelExtractor.js: A class that extracts data from one of the relevant Excel files.
* Scraper.js: The main scraper script. It uses the CacheManager and ExcelExtractor classes to pull data from the website.

