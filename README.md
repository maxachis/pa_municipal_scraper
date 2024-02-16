This script will be used to pull data from the [Pennsylvania Municipal Statistics Website](https://munstats.pa.gov), per the request in https://github.com/Police-Data-Accessibility-Project/scrapers/issues/240 .

Currently, the following files exist:

* CacheManager.js: A class that manages the cache for the scraper. It is used to store and retrieve data from the cache.
* ExcelExtractor.js: A class that extracts data from one of the relevant Excel files.
* Scraper.js: The main scraper script. It uses the CacheManager and ExcelExtractor classes to pull data from the website.

This script utilizes the Puppeteer library to scrape the data from the website. It is a headless browser that allows for the automation of web page interactions. The script will navigate to the website, select the relevant data, and download the Excel files. It will then use the ExcelExtractor class to extract the data from the Excel files and store it in the cache. The CacheManager class will be used to store and retrieve the data from the cache.