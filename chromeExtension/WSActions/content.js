(function () {
    'use strict';
    console.log('WSActions pronto para injetar');
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
            console.log(`WSActions content script await: ${delay/1000} s`);
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