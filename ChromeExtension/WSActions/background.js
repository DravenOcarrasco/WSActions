chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada");
});

// Listener para mensagens internas (do content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
    return true; // Permitir resposta assíncrona
});

// Listener para mensagens externas (opcional, se necessário)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
    return true; // Permitir resposta assíncrona
});

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
        default:
            sendResponse({ status: 'error', message: 'Ação desconhecida' });
            break;
    }
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
