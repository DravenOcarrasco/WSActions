(function () {
    'use strict';
    console.log('WSActions pronto para injetar');

    // Função para gerar um identificador único
    function generateIdentifier() {
        return Math.random().toString(36).substr(2, 16);
    }

    // Função para armazenar o identificador usando chrome.storage
    function storeIdentifier(identifier) {
        chrome.storage.sync.set({ identifier: identifier }, function () {
            console.log('Identificador armazenado:', identifier);
        });
    }

    // Função para obter o identificador armazenado
    function getIdentifier(callback) {
        chrome.storage.sync.get('identifier', function (data) {
            callback(data.identifier);
        });
    }

    // Função para injetar um script externo que define a variável window.identifier
    function injectIdentifierScript(identifier) {
        const scriptElement = document.createElement('script');
        const scriptURL = chrome.runtime.getURL('identifierScript.js');

        scriptElement.src = scriptURL;
        scriptElement.onload = function() {
            const event = new CustomEvent('setIdentifier', { detail: { identifier: identifier } });
            document.dispatchEvent(event);
            scriptElement.remove();
        };
        scriptElement.onerror = function() {
            console.error('Erro ao carregar identifierScript.js a partir de:', scriptURL);
        };

        document.head.appendChild(scriptElement);
    }

    // Função para obter a porta do serviço armazenada
    function getServicePort(callback) {
        chrome.storage.sync.get('servicePort', function (data) {
            callback(data.servicePort);
        });
    }

    // Função para obter o atraso do script armazenado
    function getScriptDelay(callback) {
        chrome.storage.sync.get('scriptDelay', function (data) {
            callback(data.scriptDelay);
        });
    }

    const defaultPort = 9514;
    const defaultDelay = 0;

    // Obter o identificador armazenado
    getIdentifier(function (identifier) {
        if (!identifier) {
            const newIdentifier = generateIdentifier();
            storeIdentifier(newIdentifier);
            injectIdentifierScript(newIdentifier);
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        } else {
            injectIdentifierScript(identifier);
            console.log('Identificador armazenado:', identifier);
        }
    });

    // Obter a porta do serviço armazenada
    getServicePort(function (port) {
        if (!port) {
            port = defaultPort;
        }

        // Obter o atraso do script armazenado
        getScriptDelay(function (delay) {
            if (!delay) {
                delay = defaultDelay;
            }
            console.log(`WSActions content script await: ${delay / 1000} s`);
            // Aguardar o atraso definido antes de injetar o script
            setTimeout(() => {
                console.log('WSActions content script injected');
                const clientScript = document.createElement('script');
                clientScript.src = `http://127.0.0.1:${port}/client.js`;
                document.head.appendChild(clientScript);

                clientScript.onload = () => {
                    console.log('client.js carregado com sucesso');
                };

                clientScript.onerror = () => {
                    console.error('Erro ao carregar client.js');
                };
            }, delay);
        });
    });
})();
