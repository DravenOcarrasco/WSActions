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
    const allowedExtensionNames = await getValue('allowedExtensionNames');
    

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
                    delay: delay || 1,
                    allowedExtensionNames: allowedExtensionNames || []
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

    // Função para escutar mensagens da página web
    window.addEventListener("message", async function(event) {
        // Ignora mensagens que não vêm da própria página
        if (event.source !== window) return;
        if (event.data && event.data.type === "FROM_WSPAGE") {
            // Retrieve the list of allowed extension names from storage
            const allowedExtensions = await getValue('allowedExtensionNames') || [];

            // Ensure that allowedExtensions is an array
            const extensionsList = Array.isArray(allowedExtensions) ? allowedExtensions : [];

            // Retrieve the extension name from the event data
            const extensionName = event.data.ext_name;

            // Verify if the extension name is in the allowed list (case-insensitive)
            const isAllowed = extensionsList.some(
                (allowedName) => allowedName.toLowerCase() === extensionName.toLowerCase()
            );

            if (!isAllowed) {
                console.warn(`${event.data.ext_name} Extension not allowed.`);
                return
            }

            // Envia a mensagem para o background script
            chrome.runtime.sendMessage({
                action: event.data.action,  // 'open_page', 'change_page' ou 'close_page'
                url: event.data.url,
                closeActiveTab: event.data.closeActiveTab,  // Para 'close_page'
                tabId: event.data.tabId  // Para 'close_page' (opcional)
            }, function(response) {
                if (response) {
                    // Envia uma resposta de volta para a página web
                    window.postMessage({
                        type: "FROM_WSACTION_EXTCHROME",
                        status: response.status,
                        message: response.message
                    }, "*");
                } else {
                    // Se não houver resposta, enviar erro
                    window.postMessage({
                        type: "FROM_WSACTION_EXTCHROME",
                        status: "error",
                        message: "Nenhuma resposta recebida da extensão."
                    }, "*");
                }
            });
        }
    }, false);
}

// Inicializar o script
initialize();