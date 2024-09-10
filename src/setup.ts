import puppeteer from 'puppeteer';

puppeteer.launch().then(browser => {
    console.log('Chromium baixado e Puppeteer configurado.');
    return browser.close();
}).catch(error => {
    console.error('Erro ao configurar o Puppeteer:', error);
});