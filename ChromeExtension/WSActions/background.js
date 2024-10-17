// background.js

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extensão instalada");
});

// Listener para mensagens internas (do content script)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
});

// Listener para mensagens externas (opcional, se necessário)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
    handleMessage(request, sendResponse);
});

/**
 * Função para tratar diferentes tipos de ações de mensagens
 */
function handleMessage(request, sendResponse) {
    if (request.action === 'open_page') {
        handleOpenPage(request, sendResponse);
    } else if (request.action === 'change_page') {
        handleChangePage(request, sendResponse);
    } else if (request.action === 'close_page') {
        handleClosePage(request, sendResponse);
    } else {
        sendResponse({ status: 'error', message: 'Ação desconhecida' });
    }

    // Retornar true para permitir resposta assíncrona
    return true;
}

/**
 * Função para lidar com a ação 'open_page'
 */
function handleOpenPage(request, sendResponse) {
    if (request.url && isValidURL(request.url)) {
        chrome.tabs.create({ url: request.url }, function(tab) {
            if (chrome.runtime.lastError) {
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
                sendResponse({ status: 'success', message: 'Página aberta com sucesso!', tabId: tab.id });
            }
        });
    } else {
        sendResponse({ status: 'error', message: 'URL inválida ou não fornecida.' });
    }
}

/**
 * Função para lidar com a ação 'change_page'
 * Verifica se a aba com a URL já está aberta. Se estiver, ativa-a. Caso contrário, muda a aba ativa ou abre uma nova aba.
 */
function handleChangePage(request, sendResponse) {
    if (request.url && isValidURL(request.url)) {
        const targetURL = normalizeURL(request.url);

        // Buscar todas as abas que correspondem à URL fornecida
        chrome.tabs.query({}, function(tabs) {
            // Encontrar uma aba que corresponda à URL
            const existingTab = tabs.find(tab => {
                const tabURL = normalizeURL(tab.url);
                return tabURL === targetURL;
            });

            if (existingTab) {
                // Se a aba existir, ativá-la e focar sua janela
                chrome.tabs.update(existingTab.id, { active: true }, function(tab) {
                    if (chrome.runtime.lastError) {
                        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                    } else {
                        // Focar na janela que contém a aba
                        chrome.windows.update(tab.windowId, { focused: true }, function() {
                            sendResponse({ status: 'success', message: `Aba existente ativada com sucesso!`, tabId: tab.id });
                        });
                    }
                });
            } else {
                // Se a aba não existir, verificar se tabId foi fornecido
                if (request.tabId) {
                    // Atualizar a aba específica com a nova URL
                    chrome.tabs.update(request.tabId, { url: request.url }, function(tab) {
                        if (chrome.runtime.lastError) {
                            sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                        } else {
                            sendResponse({ status: 'success', message: 'Página atualizada com sucesso na aba específica!', tabId: tab.id });
                        }
                    });
                } else {
                    // Atualizar a aba ativa com a nova URL
                    chrome.tabs.query({ active: true, currentWindow: true }, function(activeTabs) {
                        if (activeTabs.length > 0) {
                            chrome.tabs.update(activeTabs[0].id, { url: request.url }, function(tab) {
                                if (chrome.runtime.lastError) {
                                    sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                                } else {
                                    sendResponse({ status: 'success', message: 'Página atualizada com sucesso na aba ativa!', tabId: tab.id });
                                }
                            });
                        } else {
                            sendResponse({ status: 'error', message: 'Nenhuma aba ativa encontrada.' });
                        }
                    });
                }
            }
        });
    } else {
        sendResponse({ status: 'error', message: 'URL inválida ou não fornecida.' });
    }
}

/**
 * Função para lidar com a ação 'close_page'
 */
function handleClosePage(request, sendResponse) {
    if (request.tabId) {
        // Fecha uma aba específica
        chrome.tabs.remove(request.tabId, function() {
            if (chrome.runtime.lastError) {
                sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
            } else {
                sendResponse({ status: 'success', message: `Aba com ID ${request.tabId} fechada com sucesso!` });
            }
        });
    } else if (request.closeActiveTab) {
        // Fecha a aba ativa
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs.length > 0) {
                chrome.tabs.remove(tabs[0].id, function() {
                    if (chrome.runtime.lastError) {
                        sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                    } else {
                        sendResponse({ status: 'success', message: 'Aba ativa fechada com sucesso!' });
                    }
                });
            } else {
                sendResponse({ status: 'error', message: 'Nenhuma aba ativa encontrada.' });
            }
        });
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
 * Remove partes variáveis como hash e parâmetros para comparação mais precisa, se necessário.
 * Ajuste conforme suas necessidades.
 */
function normalizeURL(url) {
    try {
        const parsedURL = new URL(url);
        // Você pode ajustar a normalização conforme necessário
        // Por exemplo, remover fragmentos (#) ou parâmetros (?q=)
        parsedURL.hash = '';
        // parsedURL.search = ''; // Descomente se desejar remover os parâmetros de busca
        return parsedURL.toString();
    } catch (_) {
        return url;
    }
}
