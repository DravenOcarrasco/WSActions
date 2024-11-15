// =======================
// Constantes de Mensagem
// =======================

const MESSAGE_TYPES = {
    FROM_WSPAGE: "FROM_WSPAGE",
    FROM_EXTCHROME: "FROM_WSACTION_EXTCHROME",
};

// =======================
// Utilitários
// =======================

/**
 * Gera um identificador único.
 * @returns {string} Identificador único.
 */
function generateIdentifier() {
    return Math.random().toString(36).substr(2, 16);
}

// =======================
// Armazenamento
// =======================

/**
 * Armazena um valor no chrome.storage.sync.
 * @param {string} key - Chave para armazenar o valor.
 * @param {*} value - Valor a ser armazenado.
 */
function storeValue(key, value) {
    const obj = { [key]: value };
    chrome.storage.sync.set(obj, () => {
        console.log(`${key} armazenado:`, value);
    });
}

/**
 * Obtém um valor do chrome.storage.sync.
 * @param {string} key - Chave do valor a ser obtido.
 * @returns {Promise<*>} Promessa que resolve com o valor obtido.
 */
function getValue(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, (data) => {
            resolve(data[key]);
        });
    });
}

// =======================
// Injeção de Scripts
// =======================

/**
 * Injeta um script no documento para definir a variável window.identifier.
 * @param {Object} config - Configurações para o script.
 * @param {string} config.ip - Endereço IP do servidor.
 * @param {number} config.port - Porta do serviço.
 * @param {string} config.identifier - Identificador único.
 * @param {number} config.delay - Atraso para carregamento do client.js.
 * @param {Array<string>} config.allowedExtensionNames - Lista de nomes de extensões permitidas.
 */
function injectIdentifierScript({ ip, port, identifier, delay, allowedExtensionNames }) {
    const scriptElement = document.createElement('script');
    const scriptURL = chrome.runtime.getURL('idScript.js');

    scriptElement.src = scriptURL;

    scriptElement.onload = () => {
        const event = new CustomEvent('setWsActionConfig', {
            detail: {
                ip: ip || '127.0.0.1',
                port: port || 9514,
                identifier,
                delay: delay || 1,
                allowedExtensionNames: allowedExtensionNames || [],
            },
        });
        document.dispatchEvent(event);
        scriptElement.remove();
    };

    scriptElement.onerror = () => {
        console.error('Erro ao carregar idScript.js a partir de:', scriptURL);
    };

    document.head.appendChild(scriptElement);
}

/**
 * Injeta o client.js no documento após um atraso especificado.
 * @param {Object} config - Configurações para o client.js.
 * @param {string} config.ip - Endereço IP do servidor.
 * @param {number} config.port - Porta do serviço.
 * @param {number} config.delay - Atraso para carregamento.
 */
function injectClientScript({ ip, port, delay }) {
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

// =======================
// Validação e Autorização
// =======================

/**
 * Valida se uma URL é válida.
 * @param {string} url - URL a ser validada.
 * @returns {boolean} Verdadeiro se a URL for válida, falso caso contrário.
 */
function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Normaliza uma URL para fins de comparação.
 * @param {string} url - URL a ser normalizada.
 * @returns {string} URL normalizada.
 */
function normalizeURL(url) {
    try {
        const parsedURL = new URL(url);
        parsedURL.hash = '';
        return parsedURL.toString();
    } catch (_) {
        return url;
    }
}

/**
 * Verifica se a extensão está na lista de extensões permitidas.
 * @param {Array<string>} allowedExtensions - Lista de nomes de extensões permitidas.
 * @param {string} extensionName - Nome da extensão a ser verificada.
 * @returns {boolean} Verdadeiro se permitida, falso caso contrário.
 */
function isExtensionAllowed(allowedExtensions, extensionName) {
    return allowedExtensions.some(
        (allowedName) => allowedName.toLowerCase() === extensionName.toLowerCase()
    );
}

// =======================
// Manipulação de Mensagens
// =======================

/**
 * Envia uma mensagem de resposta para a página web.
 * @param {string} status - Status da resposta ('success' ou 'error').
 * @param {string} message - Mensagem detalhada.
 */
function sendResponseToPage(status, message) {
    window.postMessage(
        {
            type: MESSAGE_TYPES.FROM_EXTCHROME,
            status,
            message,
        },
        "*"
    );
}

/**
 * Listener para mensagens da página web.
 * @param {MessageEvent} event - Evento de mensagem recebido.
 */
async function messageListener(event) {
    // Verifica a origem da mensagem para segurança
    if (event.source !== window) return;
    if (event.data && event.data.type === MESSAGE_TYPES.FROM_WSPAGE) {
        try {
            const { ext_name, action, url, closeActiveTab, tabId } = event.data;

            // Validação da extensão
            const allowedExtensions = await getValue('allowedExtensionNames');
            const extensionsList = Array.isArray(allowedExtensions) ? allowedExtensions : [];

            if (!isExtensionAllowed(extensionsList, ext_name)) {
                console.warn(`${ext_name} Extension não permitida.`);
                return;
            }

            // Validação da ação e URL
            if (!action || !['open_page', 'change_page', 'close_page'].includes(action)) {
                sendResponseToPage('error', 'Ação desconhecida ou não suportada.');
                return;
            }

            if (['open_page', 'change_page'].includes(action) && !isValidURL(url)) {
                sendResponseToPage('error', 'URL inválida ou não fornecida.');
                return;
            }

            // Envia a mensagem para o background script
            chrome.runtime.sendMessage(
                {
                    action,
                    url,
                    closeActiveTab: closeActiveTab || false,
                    tabId: tabId || null,
                },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Erro na comunicação com o background script:', chrome.runtime.lastError);
                        sendResponseToPage('error', 'Erro na comunicação com a extensão.');
                        return;
                    }

                    if (response) {
                        sendResponseToPage(response.status, response.message);
                    } else {
                        sendResponseToPage('error', 'Nenhuma resposta recebida da extensão.');
                    }
                }
            );
        } catch (error) {
            console.error('Erro ao processar a mensagem:', error);
            sendResponseToPage('error', 'Erro interno ao processar a mensagem.');
        }
    }
}

// =======================
// Inicialização
// =======================

/**
 * Função principal de inicialização.
 */
async function initialize() {
    try {
        // Obtém ou gera o identificador único
        let identifier = await getValue('identifier');
        if (!identifier) {
            identifier = generateIdentifier();
            storeValue('identifier', identifier);
        }

        // Obtém configurações armazenadas
        const [port, ip, delay, allowedExtensionNames] = await Promise.all([
            getValue('servicePort'),
            getValue('serverIP'),
            getValue('scriptDelay'),
            getValue('allowedExtensionNames'),
        ]);

        // Injeta o script de identificador
        injectIdentifierScript({ ip, port, identifier, delay, allowedExtensionNames });

        // Injeta o client.js após o atraso especificado
        injectClientScript({ ip, port, delay });

        // Adiciona o listener para mensagens
        window.addEventListener("message", messageListener, false);

    } catch (error) {
        console.error('Erro durante a inicialização:', error);
    }
}

// =======================
// Executa a Inicialização
// =======================

initialize();
