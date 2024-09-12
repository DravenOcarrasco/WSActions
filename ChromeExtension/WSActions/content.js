// Função para gerar um identificador único
function generateIdentifier() {
    return Math.random().toString(36).substr(2, 16);
}

// Função para armazenar um valor usando chrome.storage
function storeValue(key, value) {
    let obj = {};
    obj[key] = value;
    chrome.storage.sync.set(obj, function () {
        console.log(`${key} armazenado:`, value);
    });
}

// Função para obter um valor armazenado usando Promises
function getValue(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, function (data) {
            resolve(data[key]);
        });
    });
}

async function initialize() {
    let identifier = await getValue('identifier');
    if (!identifier) {
        identifier = generateIdentifier();
        storeValue('identifier', identifier);
    }

    const port = await getValue('servicePort');
    const ip = await getValue('serverIP');
    const delay = await getValue('scriptDelay');

    // Função para injetar um script externo que define a variável window.identifier
    function injectIdentifierScript() {
        const scriptElement = document.createElement('script');
        const scriptURL = chrome.runtime.getURL('idScript.js');

        scriptElement.src = scriptURL;
        scriptElement.onload = function() {
            const event = new CustomEvent('setWsActionConfig', {
                detail: {
                    ip: ip || '127.0.0.1',
                    port: port || 9514,
                    identifier,
                    delay: delay || 1
                } 
            });
            document.dispatchEvent(event);
            scriptElement.remove();
        };
        scriptElement.onerror = function() {
            console.error('Erro ao carregar identifierScript.js a partir de:', scriptURL);
        };

        document.head.appendChild(scriptElement);
    }

    injectIdentifierScript()

    setTimeout(() => {
        const clientScript = document.createElement('script');
        clientScript.src = `http://${ip}:${port}/client.js`;
        document.head.appendChild(clientScript);

        clientScript.onload = () => {
            console.log('client.js carregado com sucesso');
        };

        clientScript.onerror = () => {
            console.error('Erro ao carregar client.js');
        };
    }, delay || 1);
}

// Inicializar o script
initialize();