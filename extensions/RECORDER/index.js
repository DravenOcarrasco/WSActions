const fs = require('fs');
const path = require('path');

/**
 * Módulo da extensão.
 * 
 * @param {import('socket.io').Server} WSIO - Instância do WebSocket IO.
 * @param {import('express').Application} APP - Instância do Express.
 * @param {import('readline').Interface} RL - Instância do Readline.
 * @param {Object} STORAGE - Objeto de armazenamento compartilhado.
 * @param {Object} STORAGE.data - Objeto que contém os dados de armazenamento.
 * @param {Function} STORAGE.save - Função que salva o armazenamento.
 * @param {typeof import('express')} EXPRESS - Classe Express.
 * 
 * @returns {{ start: Function, stop: Function }} - Objeto da extensão com funções `start` e `stop`.
 */
module.exports = (WSIO, APP, RL, STORAGE, EXPRESS) => {
    const ROUTER = EXPRESS.Router();
    const NAME = "RECORDER";
    const ENABLED = true;
    
    let elementCounter = 0;

    const IOEVENTS = {
        "make:script": {
            description: "Gera um script Puppeteer baseado no histórico de ações",
            _function: (data) => {
                console.log(data);
                const { history, name } = data;
                const processedHistory = processHistory(history);
                const script = generatePuppeteerScript(processedHistory);
                const scriptsDir = path.join(__dirname, "../../automate");

                if (!fs.existsSync(scriptsDir)) {
                    fs.mkdirSync(scriptsDir);
                }

                const filePath = path.join(scriptsDir, `${name}.js`);

                fs.writeFile(filePath, script, (err) => {
                    if (err) {
                        console.error(`Erro ao salvar o script: ${err.message}`);
                        WSIO.emit(`${NAME}:error`, { message: `Erro ao salvar o script: ${err.message}` });
                    } else {
                        console.log(`Script salvo em: ${filePath}`);
                        WSIO.emit(`${NAME}:scriptGenerated`, { message: `Script salvo em: ${filePath}` });
                    }
                });
            }
        }
    };

    const COMMANDS = {};

    const processHistory = (history) => {
        elementCounter = 0;
        const processedHistory = [];
        let typingSequence = [];
        let lastTimestamp = null;
        for (const timestamp in history) {
            const action = history[timestamp];
            if (['keydown', 'keyup', 'keypress'].includes(action.action)) {
                typingSequence.push(action);
            } else {
                if (['input', 'change'].includes(action.action) && typingSequence.length > 0) {
                    const lastTypingAction = typingSequence[typingSequence.length - 1];
                    const delay = lastTimestamp ? new Date(lastTypingAction.timestamp) - new Date(lastTimestamp) : 0;
                    lastTypingAction.delay = delay >= 0 ? delay : 0;
                    processedHistory.push(lastTypingAction);
                    typingSequence = [];
                }

                const delay = lastTimestamp ? new Date(timestamp) - new Date(lastTimestamp) : 0;
                action.delay = delay >= 0 ? delay : 0;
                processedHistory.push(action);
                lastTimestamp = timestamp;
            }
        }

        if (typingSequence.length > 0) {
            const lastTypingAction = typingSequence[typingSequence.length - 1];
            const delay = lastTimestamp ? new Date(lastTypingAction.timestamp) - new Date(lastTimestamp) : 0;
            lastTypingAction.delay = delay >= 0 ? delay : 0;
            processedHistory.push(lastTypingAction);
        }

        return processedHistory;
    };

    const generatePuppeteerScript = (history) => {
        let script = `
const { Browser, Page } = require("puppeteer");

async function addDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Puppeteer script generated based on user actions history.
 * This script automates the browser to replicate user interactions.
 *
 * @param {Browser} browser - The Puppeteer browser instance.
 * @see {@link https://pptr.dev/|Puppeteer Documentation}
 */
async function runScript(browser) {
    /**
     * Opens a new page or brings to front an existing page matching the URL pattern.
     *
     * @param {string} urlPattern - The URL pattern to match.
     * @returns {Page} page - The Puppeteer page instance.
     */
    async function goToPageIfNotOpen(urlPattern, extraDelay = 1000) {
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
        await page.goto(urlPattern, { waitUntil: 'load', timeout: 60000 });

        // Wait for the extra delay if specified
        if (extraDelay > 0) {
            await addDelay(extraDelay);
        }

        return page;
    }
    
    /**
     * Finds an element using XPath and waits for it to be present.
     *
     * @param {Page} page - The Puppeteer page instance.
     * @param {string} xpath - The XPath expression to find the element.
     * @param {number} [timeout=60000] - The timeout in milliseconds to wait for the element.
     * @returns {Promise<ElementHandle|null>} - The ElementHandle if found, or null if not found.
     */
    async function getElementByXPath(page, xpath, timeout = 60000) {
        try {
            // Adjust the XPath if it starts with '//*' or '//'
            let adjustedXPath = xpath;
            if (xpath.startsWith('//*') || xpath.startsWith('//')) {
                adjustedXPath = 'xpath//' + xpath;
            }
            // Wait for the element to be present
            await page.waitForSelector(adjustedXPath, { timeout });
            // Get the element
            const element = await page.$(adjustedXPath);
            return element;
        } catch (error) {
            console.error(\`Element not found for XPath: \${xpath}\`);
            return null;
        }
    }

    let page = null;
`;

        let currentUrl = null;

        for (const action of history) {
            if (currentUrl !== action.location) {
                currentUrl = action.location;
                script += `
    page = await goToPageIfNotOpen('${currentUrl}');
`;
            }
            script += generateActionCommand(action);
        }

        script += `
    browser.close();
}

module.exports = { runScript };
`;
        return script;
    };

    const generateActionCommand = (action) => {
        const delayScript = action.delay > 0 ? `    await addDelay(${action.delay});\n` : '';
        const selector = transformSelector(action.selector);

        let clickButton;
        switch (action.additionalInfo.button) {
            case 0:
                clickButton = 'left';
                break;
            case 1:
                clickButton = 'middle';
                break;
            case 2:
                clickButton = 'right';
                break;
            default:
                clickButton = 'left'; // Default to left button if not specified
        }

        let command = '';
        let elementName = `element${elementCounter++}`;
        switch (action.action) {
            case 'click':
            case 'dblclick':
            case 'mousedown':
            case 'mouseup':
                command = `
${delayScript}    const ${elementName} = await page.waitForSelector('${selector}');
    await ${elementName}.click({ button: '${clickButton}' });
    await addDelay(1000);
`;
                break;
            case 'keydown':
            case 'keyup':
            case 'keypress':
                command = `${delayScript}    await page.keyboard.press('${action.additionalInfo.key}');\n`;
                break;
            case 'input':
            case 'change':
                elementName = `inputElement${elementCounter}`;
                command = `${delayScript}    const ${elementName} = await page.waitForSelector('${selector}');
    await ${elementName}.type('${action.value}');
`;
                break;
            case 'scroll':
                command = `${delayScript}    await page.evaluate(() => { window.scrollTo(${action.additionalInfo.scrollX}, ${action.additionalInfo.scrollY}); });\n`;
                break;
        }
        elementCounter++;
        return command;
    };

    const transformSelector = (selector) => {
        return isXPath(selector) ? `xpath/${selector}` : selector;
    };

    const isXPath = (selector) => {
        return selector && (selector.startsWith('/') || selector.startsWith('('));
    };

    const onInitialize = () => {
        console.log(`${NAME} initialized.`);
    };

    const onError = (error) => {
        console.error(`${NAME} error: ${error.message}`);
    };

    const CLIENT_LINK = `${NAME}/client`;

    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        onInitialize,
        onError
    };
};
