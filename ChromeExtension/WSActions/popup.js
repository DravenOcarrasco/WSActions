const defaultPort = 9514;
const defaultDelay = 1000;
const defaultIP = '127.0.0.1';

let isChanged = false;

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

// Função para armazenar a porta do serviço
function storeServicePort(port) {
    chrome.storage.sync.set({ servicePort: port }, function () {
        console.log('Porta do serviço armazenada:', port);
    });
}

// Função para obter a porta do serviço armazenada
function getServicePort(callback) {
    chrome.storage.sync.get('servicePort', function (data) {
        callback(data.servicePort);
    });
}

// Função para armazenar o atraso do script
function storeScriptDelay(delay) {
    chrome.storage.sync.set({ scriptDelay: delay }, function () {
        console.log('Atraso do script armazenado:', delay);
    });
}

// Função para obter o atraso do script armazenado
function getScriptDelay(callback) {
    chrome.storage.sync.get('scriptDelay', function (data) {
        callback(data.scriptDelay);
    });
}

// Função para armazenar o IP do servidor
function storeServerIP(ip) {
    chrome.storage.sync.set({ serverIP: ip }, function () {
        console.log('IP do servidor armazenado:', ip);
    });
}

// Função para obter o IP do servidor armazenado
function getServerIP(callback) {
    chrome.storage.sync.get('serverIP', function (data) {
        callback(data.serverIP);
    });
}

// Função para verificar a conexão com o serviço
function checkConnection(ip, port) {
    const url = `http://${ip}:${port}/client.js`;
    fetch(url)
    .then(response => {
        if (response.ok) {
            document.getElementById('status').innerText = 'Conectado';
            document.getElementById('status').classList.remove('text-danger');
            document.getElementById('status').classList.add('text-success');
            console.log('client.js carregado com sucesso');
        }
    })
    .catch(() => {
        document.getElementById('status').innerText = 'Desconectado';
        document.getElementById('status').classList.remove('text-success');
        document.getElementById('status').classList.add('text-danger');
    });
}

function showReloadButton() {
    const reloadButton = document.getElementById('reloadButton');
    reloadButton.style.display = 'block';
}

function sendReloadEvent() {
    const event = new CustomEvent('wsActionReloadPage', {});
    document.dispatchEvent(event);
}

document.addEventListener('DOMContentLoaded', function () {
    // Verificar se o identificador já está armazenado
    getIdentifier(function (identifier) {
        if (identifier) {
            console.log('Identificador armazenado:', identifier);
            document.getElementById('deviceId').innerText = identifier;
            document.getElementById('identifier').value = identifier; // Exibir no campo de texto
            // window.identifier = identifier;
        } else {
            const newIdentifier = generateIdentifier();
            storeIdentifier(newIdentifier);
            storeServicePort(defaultPort);
            storeScriptDelay(defaultDelay);
            storeServerIP(defaultIP);
            document.getElementById('identifier').value = newIdentifier; // Exibir no campo de texto
            window.identifier = newIdentifier;
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        }
    });

    // Monitorar mudanças no campo de identificador e salvar automaticamente
    document.getElementById('identifier').addEventListener('input', function () {
        const identifier = this.value;
        if (identifier) {
            storeIdentifier(identifier);
            isChanged = true;
            showReloadButton();
        }
    });

    // Monitorar mudanças nos campos e salvar automaticamente
    document.getElementById('servicePort').addEventListener('input', function () {
        const port = this.value;
        if (port) {
            storeServicePort(port);
            isChanged = true;
            showReloadButton();
        }
    });

    document.getElementById('scriptDelay').addEventListener('input', function () {
        const delay = this.value;
        if (delay !== '') {
            storeScriptDelay(delay);
            isChanged = true;
            showReloadButton();
        }
    });

    document.getElementById('serverIP').addEventListener('input', function () {
        const ip = this.value;
        if (ip) {
            storeServerIP(ip);
            isChanged = true;
            showReloadButton();
        }
    });

    // Carregar a porta do serviço armazenada no input ao carregar a página
    getServicePort(function (port) {
        if (port) {
            document.getElementById('servicePort').value = port;
            getServerIP(function (ip) {
                checkConnection(ip || defaultIP, port);
            });
        }
    });

    // Carregar o atraso do script armazenado no input ao carregar a página
    getScriptDelay(function (delay) {
        if (delay) {
            document.getElementById('scriptDelay').value = delay;
        }
    });

    // Carregar o IP do servidor armazenado no input ao carregar a página
    getServerIP(function (ip) {
        if (ip) {
            document.getElementById('serverIP').value = ip;
        }
    });

    // Botão para enviar o evento de recarregar para todas as abas
    document.getElementById('reloadButton').addEventListener('click', function () {
        if (isChanged) {
            sendReloadEvent();
        }
    });
});
