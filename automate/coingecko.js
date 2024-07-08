
const puppeteer = require('puppeteer');

async function addDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeScript(browser) {
    async function goToPageIfNotOpen(urlPattern) {
        const pages = await browser.pages();
        const regex = new RegExp(urlPattern);
        for (let p of pages) {
            const pageUrl = await p.url();
            if (regex.test(pageUrl)) {
                await p.bringToFront();
                await addDelay(1000);
                return p;
            }
        }
        let page = await browser.newPage();
        await page.goto(urlPattern, { waitUntil: 'networkidle2', timeout: 30000 });
        return page;
    }

    let page = null;

    page = await goToPageIfNotOpen('https://www.coingecko.com/pt');

    await addDelay(376);
    const element52 = await page.waitForSelector('::-p-xpath(/html/body/header/div[2]/div[3]/div/div[3]/div[6]/a/div[2])');
    await element52.click({ button: 'left' });
    await addDelay(1000);

    page = await goToPageIfNotOpen('https://www.coingecko.com/pt/candy');
    await addDelay(65);
    await page.evaluate(() => { window.scrollTo(0, 1); });
    await addDelay(19);
    await page.evaluate(() => { window.scrollTo(0, 6); });
    await addDelay(23);
    await page.evaluate(() => { window.scrollTo(0, 13); });
    await addDelay(10);
    await page.evaluate(() => { window.scrollTo(0, 23); });
    await addDelay(13);
    await page.evaluate(() => { window.scrollTo(0, 36); });
    await addDelay(18);
    await page.evaluate(() => { window.scrollTo(0, 51); });
    await addDelay(26);
    await page.evaluate(() => { window.scrollTo(0, 69); });
    await addDelay(18);
    await page.evaluate(() => { window.scrollTo(0, 89); });
    await addDelay(97);
    await page.evaluate(() => { window.scrollTo(0, 193); });
    await addDelay(1);
    await page.evaluate(() => { window.scrollTo(0, 193); });
    await addDelay(52);
    await page.evaluate(() => { window.scrollTo(0, 200); });
    await addDelay(1669);
    await page.keyboard.press('r');
    browser.close()
}

module.exports = { executeScript };
