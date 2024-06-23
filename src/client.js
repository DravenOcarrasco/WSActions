// ==UserScript==
// @name         WebSocket Client for Tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.13
// @description  Connects to a secure WebSocket server and performs actions based on commands received
// @author       Your Name
// @match        *://*/*
// @grant        none
// ==/UserScript==

(async function () {
    'use strict';

    // Função para obter a porta do serviço armazenada
    async function getServicePort() {
        return new Promise((resolve) => {
            chrome.storage.sync.get('servicePort', function (data) {
                resolve(data.servicePort);
            });
        });
    }

    document.addEventListener('keydown', function (event) {
        console.log(event.ctrlKey)
        if (event.ctrlKey && event.altKey && event.key === 'c') {
            loadEnabledExtensions().then(enabledExtensions => {
                showExtensionsPanel(enabledExtensions);
            });
        }
    });

    // Função para adicionar um script ao documento e retornar uma Promise
    function addScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    const PORT = await getServicePort()
    // Adicionando as bibliotecas jQuery, SweetAlert e Socket.IO
    Promise.all([
        addScript('https://code.jquery.com/jquery-3.6.0.min.js'),
        addScript('https://cdn.jsdelivr.net/npm/sweetalert2@11'),
        addScript('https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.4.0/socket.io.js')
    ]).then(() => {
        // Função para carregar extensões habilitadas
        function loadEnabledExtensions() {
            return fetch(`https://127.0.0.1:${PORT}/extensions`)
                .then(response => response.json())
                .then(data => data.ENABLED)
                .catch(error => {
                    console.error('Erro ao carregar extensões:', error);
                    setTimeout(() => {
                        window.open(`https://127.0.0.1:${PORT}/extensions`, '_blank');
                    }, 5000);
                    return [];
                });
        }

        loadEnabledExtensions().then(enabledExtensions => {
            console.log(enabledExtensions);
            if (enabledExtensions.length === 0) {
                console.log('Nenhuma extensão habilitada encontrada.');
                return;
            }

            console.log('Extensões habilitadas:', enabledExtensions);

            // Carrega os scripts das extensões habilitadas
            enabledExtensions.forEach(extension => {
                if (extension.CLIENT_LINK) {
                    const scriptUrl = `https://127.0.0.1:${PORT}/${extension.CLIENT_LINK}`;
                    addScript(scriptUrl);
                }
            });
        });

        // Função para criar e mostrar o painel de extensões
        function showExtensionsPanel(extensions) {
            // Verifica se o painel já existe e remove se necessário
            let existingPanel = document.getElementById('extensionsPanel');
            if (existingPanel) {
                existingPanel.remove();
            }

            // Cria o painel
            const panel = document.createElement('div');
            panel.id = 'extensionsPanel';
            panel.style.position = 'fixed';
            panel.style.top = '10px';
            panel.style.right = '10px';
            panel.style.width = '300px';
            panel.style.height = '400px';
            panel.style.backgroundColor = 'white';
            panel.style.border = '1px solid #ccc';
            panel.style.zIndex = 10000;
            panel.style.overflowY = 'scroll';
            panel.style.padding = '10px';
            panel.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';

            // Adiciona título ao painel
            const title = document.createElement('h3');
            title.textContent = 'Extensões Carregadas';
            panel.appendChild(title);

            // Lista as extensões
            extensions.forEach(extension => {
                const extensionItem = document.createElement('div');
                extensionItem.textContent = extension.CLIENT_NAME || 'Extensão Desconhecida';
                panel.appendChild(extensionItem);
            });

            document.body.appendChild(panel);
        }
    }).catch(error => {
        console.error('Erro ao carregar scripts:', error);
    });
})();
