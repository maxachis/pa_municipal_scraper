const puppeteer = require('puppeteer');

 const Status = Object.freeze({
    RETRIEVED: 'RETRIEVED',
    RETRIEVAL_FAILED: 'RETRIEVAL_FAILED',
    UNAVAILABLE: 'UNAVAILABLE',
    NOT_ATTEMPTED: 'NOT_ATTEMPTED'
});

async function launchBrowser(url, headless = true, logFunction = console.log) {
    const browser = await puppeteer.launch({
        headless: headless,
        args: ["--incognito"]
    });
    const { page, client } = await setupAndNavigate(browser, url, logFunction);
    return { page, client, browser };
}

async function setupAndNavigate(browser, url, logFunction = console.log) {
    try {
        const page = await browser.newPage();
        const client = await page.target().createCDPSession();
        await page.goto(url, { waitUntil: 'networkidle2' });

        page.on('console', msg => logFunction(`PAGE LOG: ${msg.text()}`));
        page.on('error', err => logFunction(`PAGE ERROR: ${err.message}`));
        page.on('pageerror', err => {logFunction('PAGE ERROR:', err.message);});

        logFunction(`Navigated to page ${url}`);

        // Return both page and client in an object
        return { page, client };
    } catch (error) {
        logFunction('Error in setupAndNavigate:', error.message);
        // Handle the error as needed, e.g., by rethrowing it or logging it
        throw error;
    }
}

 async function selectOption(page, selector, value) {
    await actionWithRetry(async () => {
        await page.waitForSelector(selector);
        await page.select(selector, value);
    });
}

 async function getOptions(page, selector, oldOptions) {
    let newOptions;
    do {
        await new Promise(r => setTimeout(r, 1000)); // wait for 1 second before checking again
        newOptions = await page.evaluate(selector => {
            const options = Array.from(document.querySelector(selector).options);
            return options.map(option => option.value);
        }, selector);
    } while (oldOptions && JSON.stringify(oldOptions) === JSON.stringify(newOptions));
    return newOptions;
}


 async function getSelectedOptionText(page, selector) {
    return await page.evaluate(selector => {
        return document.querySelector(selector).selectedOptions[0].textContent;
    }, selector);
}

const actionWithRetry = async (action, retryErrorMessages = [
    'The report or page is being updated',
    'Node is detached from document'
], maxRetries = 4) => {
    let lastError = null; // Initialize a variable to hold the last error
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await action();
            return; // Success, return from the function
        } catch (error) {
            lastError = error; // Update lastError with the current error
            const shouldRetry = retryErrorMessages.some(errorMessage => error.message.includes(errorMessage));
            if (shouldRetry) {
                // console.log(`Attempt ${attempt} failed, retrying...`);
                await new Promise(r => setTimeout(r, 1000 * attempt)); // Wait longer after each retry
                continue; // Continue to the next attempt
            }
            throw error; // Rethrow error if it's not one of the specified retryable errors
        }
    }
    console.error('Max retries exceeded. Last error:', lastError);
    throw lastError; // Throw the last encountered error
};

const municipalitySelector = 'select[id=ContentPlaceHolder1_ddMuniId]'

const finReportSelectors = [
    { selector: 'select[id="ContentPlaceHolder1_ddCountyId"]', type: 'county' },
    { selector: municipalitySelector, type: 'municipality' },
    { selector: 'select[id="ContentPlaceHolder1_ddYear"]', type: 'year' },
];


module.exports = {
    launchBrowser,
    selectOption,
    getOptions,
    getSelectedOptionText,
    actionWithRetry,
    Status,
    municipalitySelector,
    finReportSelectors
};