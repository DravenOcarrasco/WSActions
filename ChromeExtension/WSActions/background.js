// Inicializa as configurações padrão e aplica regras CSP imediatamente
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada");
    // Define disableCSP como true por padrão e aplica as regras
    chrome.storage.local.set({ disableCSP: true }, () => {
        setupCSPRules(true);
    });
});

// Aplica as regras CSP ao iniciar o navegador baseado na configuração salva
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['disableCSP'], (result) => {
        setupCSPRules(result.disableCSP !== false);
    });
});

// Gerenciamento do Debugger
let attachedTabs = new Set();

// Função para anexar o debugger a uma aba
async function attachDebugger(tabId) {
    if (attachedTabs.has(tabId)) return;
    
    try {
        await chrome.debugger.attach({ tabId }, '1.3');
        attachedTabs.add(tabId);
        console.log(`Debugger attached to tab ${tabId}`);
    } catch (error) {
        console.error('Error attaching debugger:', error);
    }
}

// Função para desanexar o debugger de uma aba
async function detachDebugger(tabId) {
    if (!attachedTabs.has(tabId)) return;
    
    try {
        await chrome.debugger.detach({ tabId });
        attachedTabs.delete(tabId);
        console.log(`Debugger detached from tab ${tabId}`);
    } catch (error) {
        console.error('Error detaching debugger:', error);
    }
}

// Listener para comandos do debugger
chrome.debugger.onEvent.addListener((source, method, params) => {
    // Encaminha eventos do debugger para o content script
    if (source.tabId) {
        chrome.tabs.sendMessage(source.tabId, {
            type: 'debugger_event',
            method,
            params
        });
    }
});

// Aplica regras CSP em cada navegação baseado na configuração salva
chrome.webNavigation.onCommitted.addListener((details) => {
    // Ignora frames filhos, apenas aplica na página principal
    if (details.frameId === 0) {
        chrome.storage.local.get(['disableCSP'], (result) => {
            setupCSPRules(result.disableCSP !== false);
        });
    }
});

// Listener para mensagens internas (do content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Tratamento específico para comandos do debugger
    if (request.type === 'debugger_command') {
        const tabId = sender.tab.id;
        
        if (request.action === 'attach') {
            attachDebugger(tabId)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'detach') {
            detachDebugger(tabId)
                .then(() => sendResponse({ success: true }))
                .catch(error => sendResponse({ success: false, error: error.message }));
            return true;
        }
        
        if (request.action === 'sendCommand') {
            chrome.debugger.sendCommand(
                { tabId },
                request.command,
                request.params || {},
                (result) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ success: true, result });
                    }
                }
            );
            return true;
        }
    }

    handleMessage(request, sendResponse);
    return true; // Permitir resposta assíncrona
});

// Listener para mensagens externas (opcional, se necessário)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
    return true; // Permitir resposta assíncrona
});

chrome.runtime.onStartup.addListener(initializeProxy);
// Listener para alterações de configuração de proxy
chrome.storage.onChanged.addListener((changes) => {
    if (changes.proxyMode || changes.proxyIP || changes.proxyPort) {
        setProxyConfig();
    }
});

async function setupCSPRules(enable) {
    try {
        if (enable) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1, 2],
                addRules: [
                    {
                        "id": 1,
                        "priority": 1,
                        "action": {
                            "type": "modifyHeaders",
                            "responseHeaders": [
                                {
                                    "header": "content-security-policy",
                                    "operation": "remove"
                                },
                                {
                                    "header": "content-security-policy-report-only",
                                    "operation": "remove"
                                }
                            ]
                        },
                        "condition": {
                            "urlFilter": "*",
                            "resourceTypes": ["main_frame", "sub_frame", "script"]
                        }
                    },
                    {
                        "id": 2,
                        "priority": 2,
                        "action": {
                            "type": "modifyHeaders",
                            "responseHeaders": [
                                {
                                    "header": "access-control-allow-origin",
                                    "operation": "set",
                                    "value": "*"
                                }
                            ]
                        },
                        "condition": {
                            "urlFilter": "||127.0.0.1:9514/*",
                            "resourceTypes": ["script"]
                        }
                    }
                ]
            });
            console.log("CSP rules enabled successfully");
        } else {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: [1, 2],
                addRules: []
            });
            console.log("CSP rules disabled successfully");
        }
    } catch (error) {
        console.error("Error updating CSP rules:", error);
    }
}


// Função para definir o proxy com base no modo selecionado
function setProxyConfig() {
    chrome.storage.local.get(['proxyMode', 'proxyIP', 'proxyPort'], (prefs) => {
        if (prefs.proxyMode === 'auto') {
            // Modo automático
            chrome.proxy.settings.set({ value: { mode: 'auto_detect' } });
        } else if (prefs.proxyMode === 'http' || prefs.proxyMode === 'https') {
            // Modo manual (HTTP ou HTTPS)
            const scheme = prefs.proxyMode === 'http' ? 'http' : 'https';
            const proxyConfig = {
                mode: 'fixed_servers',
                rules: {
                    singleProxy: {
                        scheme: scheme,
                        host: prefs.proxyIP,
                        port: parseInt(prefs.proxyPort)
                    },
                    bypassList: ["<local>"]
                }
            };

            chrome.proxy.settings.set({ value: proxyConfig }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Erro ao configurar proxy:', chrome.runtime.lastError);
                } else {
                    console.log('Proxy configurado:', proxyConfig);
                }
            });
        }
    });
}

function initializeProxy() {
    setProxyConfig();
}

/**
 * Função para tratar diferentes tipos de ações de mensagens
 */
function handleMessage(request, sendResponse) {
    switch (request.action) {
        case 'open_page':
            handleOpenPage(request, sendResponse);
            break;
        case 'change_page':
            handleChangePage(request, sendResponse);
            break;
        case 'close_page':
            handleClosePage(request, sendResponse);
            break;
        case 'toggleCSP':
            handleToggleCSP(request, sendResponse);
            break;
        default:
            sendResponse({ status: 'error', message: 'Ação desconhecida' });
            break;
    }
}

/**
 * Função para lidar com a ação de toggle do CSP
 */
function handleToggleCSP(request, sendResponse) {
    chrome.storage.local.set({ disableCSP: request.value }, () => {
        setupCSPRules(request.value);
        sendResponse({ status: 'success', message: `CSP ${request.value ? 'desativado' : 'ativado'} com sucesso!` });
    });
}

/**
 * Função para lidar com a ação 'open_page'
 */
async function handleOpenPage(request, sendResponse) {
    if (request.url && isValidURL(request.url)) {
        try {
            const tab = await chrome.tabs.create({ url: request.url });
            sendResponse({ status: 'success', message: 'Página aberta com sucesso!', tabId: tab.id });
        } catch (error) {
            sendResponse({ status: 'error', message: error.message });
        }
    } else {
        sendResponse({ status: 'error', message: 'URL inválida ou não fornecida.' });
    }
}

/**
 * Função para lidar com a ação 'change_page'
 */
async function handleChangePage(request, sendResponse) {
    if (request.url && isValidURL(request.url)) {
        const targetURL = normalizeURL(request.url);
        try {
            const tabs = await chrome.tabs.query({});
            const existingTab = tabs.find(tab => normalizeURL(tab.url) === targetURL);

            if (existingTab) {
                // Ativar aba existente
                await chrome.tabs.update(existingTab.id, { active: true });
                await chrome.windows.update(existingTab.windowId, { focused: true });
                sendResponse({ status: 'success', message: `Aba existente ativada com sucesso!`, tabId: existingTab.id });
            } else if (request.tabId) {
                // Atualizar aba específica
                const tab = await chrome.tabs.update(request.tabId, { url: request.url });
                sendResponse({ status: 'success', message: 'Página atualizada com sucesso na aba específica!', tabId: tab.id });
            } else {
                // Atualizar aba ativa
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTab) {
                    const tab = await chrome.tabs.update(activeTab.id, { url: request.url });
                    sendResponse({ status: 'success', message: 'Página atualizada com sucesso na aba ativa!', tabId: tab.id });
                } else {
                    sendResponse({ status: 'error', message: 'Nenhuma aba ativa encontrada.' });
                }
            }
        } catch (error) {
            sendResponse({ status: 'error', message: error.message });
        }
    } else {
        sendResponse({ status: 'error', message: 'URL inválida ou não fornecida.' });
    }
}

/**
 * Função para fechar uma aba específica.
 */
async function closeSpecificTab(tabId, sendResponse) {
    try {
        await chrome.tabs.remove(tabId);
        sendResponse({ status: 'success', message: `Aba com ID ${tabId} fechada com sucesso!` });
    } catch (error) {
        sendResponse({ status: 'error', message: error.message });
    }
}

/**
 * Função para fechar a aba ativa.
 */
async function closeActiveTab(sendResponse) {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
            await chrome.tabs.remove(activeTab.id);
            sendResponse({ status: 'success', message: 'Aba ativa fechada com sucesso!' });
        } else {
            sendResponse({ status: 'error', message: 'Nenhuma aba ativa encontrada.' });
        }
    } catch (error) {
        sendResponse({ status: 'error', message: error.message });
    }
}

/**
 * Função para lidar com a ação 'close_page'.
 */
function handleClosePage(request, sendResponse) {
    if (request.tabId == null) {
        request.tabId = undefined;
    }

    if (request.tabId) {
        closeSpecificTab(request.tabId, sendResponse);
    } else if (request.closeActiveTab) {
        closeActiveTab(sendResponse);
    } else {
        sendResponse({ status: 'error', message: 'Nenhuma opção de fechamento fornecida.' });
    }
}

/**
 * Função para validar URLs
 */
function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Função para normalizar URLs para comparação
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

// Função para configurar o proxy com base nas preferências
function setProxyMode(mode, pacScriptUrl = null) {
    let proxyConfig = { mode };

    if (mode === 'pac_script' && pacScriptUrl) {
        proxyConfig.pacScript = { url: pacScriptUrl };
    }

    chrome.proxy.settings.set({ value: proxyConfig, scope: 'regular' }, () => {
        if (chrome.runtime.lastError) {
            console.error('Erro ao configurar proxy:', chrome.runtime.lastError);
        } else {
            console.log('Proxy configurado:', proxyConfig);
        }
    });
}
