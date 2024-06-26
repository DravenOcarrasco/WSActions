(function () {
    'use strict';
    console.log('WSActions pronto para injetar');

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

    // Função para obter um valor armazenado
    function getValue(key, callback) {
        chrome.storage.sync.get(key, function (data) {
            callback(data[key]);
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

    // Função para injetar o client script após o atraso definido
    function injectClientScript(port, delay) {
        console.log(`WSActions content script aguardando: ${delay / 1000} s`);
        setTimeout(() => {
            console.log('WSActions content script injetado');
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
    }

    // Obter ou gerar e armazenar o identificador
    getValue('identifier', function (identifier) {
        if (!identifier) {
            const newIdentifier = generateIdentifier();
            storeValue('identifier', newIdentifier);
            injectIdentifierScript(newIdentifier);
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        } else {
            injectIdentifierScript(identifier);
            console.log('Identificador armazenado:', identifier);
        }
    });

    // Obter a porta do serviço armazenada
    getValue('servicePort', function (port) {
        if (port === undefined) {
            console.error('Porta do serviço não definida. Instale novamente a extensão.');
            return;
        }

        // Obter o atraso do script armazenado
        getValue('scriptDelay', function (delay) {
            if (delay === undefined) {
                console.error('Atraso do script não definido. Instale novamente a extensão.');
                return;
            }

            injectClientScript(port, delay);
        });
    });
})();