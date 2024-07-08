const fs = require('fs');
const path = require('path');
/**
 * Módulo da extensão.
 * 
 * @param {Object} WSIO - Instância do WebSocket IO.
 * @param {Object} APP - Instância do Express.
 * @param {Object} RL - Instância do Readline.
 * @param {Object} STORAGE - Objeto de armazenamento compartilhado.
 * @param {Object} STORAGE.data - Objeto de armazenamento.
 * @param {Function} STORAGE.save - Função para salvar o armazenamento.
 * @param {Object} EXPRESS - Classe Express.
 * 
 * @returns {Object} - Objeto da extensão.
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
/**
 * Puppeteer script generated based on user actions history.
 * This script automates the browser to replicate user interactions.
 *
 * @param {object} browser - The Puppeteer browser instance.
 * @see {@link https://pptr.dev/|Puppeteer Documentation}
 */

async function addDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeScript(browser) {
    /**
     * Opens a new page or brings to front an existing page matching the URL pattern.
     *
     * @param {string} urlPattern - The URL pattern to match.
     * @returns {object} page - The Puppeteer page instance.
     */
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
}

module.exports = { executeScript };
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
        return isXPath(selector) ? `::-p-xpath(${selector})` : selector;
    };

    const isXPath = (selector) => {
        return selector && (selector.startsWith('/') || selector.startsWith('('));
    };

    const COMMANDS = {
        "exampleCommand": {
            description: "Descrição do comando de exemplo",
            _function: (data) => {
                RL.question('Digite um valor de exemplo: ', (input) => {
                    WSIO.emit(`${NAME}:command`, { command: 'example', payload: input });
                });
            }
        }
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
