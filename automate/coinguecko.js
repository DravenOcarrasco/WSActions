
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

    await addDelay(469);
    const element30 = await page.waitForSelector('::-p-xpath(/html/body/header/div[2]/div[3]/div/div[3]/div[6]/a/div[2])');
    await element30.click({ button: 'left' });
    await addDelay(1000);

    page = await goToPageIfNotOpen('https://www.coingecko.com/pt/candy');
    await addDelay(4184);
    await page.keyboard.press('r');

}

module.exports = { executeScript };
