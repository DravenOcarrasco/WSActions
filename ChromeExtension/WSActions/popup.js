// popup.js

const defaultPort = 9514;
const defaultDelay = 1000;
const defaultIP = '127.0.0.1';
const defaultAllowedExtensionNames = [];

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

// Função para armazenar os nomes das extensões permitidas
function storePermissionToControl(permissions) {
    chrome.storage.sync.set({ allowedExtensionNames: permissions }, function () {
        console.log('Permissões atualizadas:', permissions);
    });
}

// Função para obter os nomes das extensões permitidas
function getPermissionToControl(callback) {
    chrome.storage.sync.get('allowedExtensionNames', function (data) {
        callback(data.allowedExtensionNames || []);
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

// Funções para gerenciar a lista de permissões (nomes das extensões)
function addExtensionToList(extensionName) {
    const allowedExtensionsList = document.getElementById('allowedExtensionsList');

    // Verificar se o nome já está na lista
    const existingItem = Array.from(allowedExtensionsList.children).find(
        item => item.getAttribute('data-extension-name').toLowerCase() === extensionName.toLowerCase()
    );
    if (existingItem) {
        alert('Este nome de extensão já está na lista de permissões.');
        return;
    }

    const listItem = document.createElement('li');
    listItem.setAttribute('data-extension-name', extensionName);

    const span = document.createElement('span');
    span.textContent = extensionName;

    const removeButton = document.createElement('button');
    removeButton.className = 'btn btn-danger btn-sm';
    removeButton.type = 'button';
    removeButton.textContent = 'Remover';

    // Evento para remover o nome da lista
    removeButton.addEventListener('click', function () {
        listItem.remove();
        saveAllowedExtensions();
    });

    listItem.appendChild(span);
    listItem.appendChild(removeButton);
    allowedExtensionsList.appendChild(listItem);

    // Atualizar armazenamento
    saveAllowedExtensions();
}

function saveAllowedExtensions() {
    const allowedExtensionsList = document.getElementById('allowedExtensionsList');
    const extensions = Array.from(allowedExtensionsList.children).map(
        item => item.getAttribute('data-extension-name')
    );
    storePermissionToControl(extensions);
}

function loadAllowedExtensions() {
    getPermissionToControl(function (extensions) {
        const allowedExtensionsList = document.getElementById('allowedExtensionsList');
        allowedExtensionsList.innerHTML = ''; // Limpar lista antes de carregar

        extensions.forEach(extensionName => {
            const listItem = document.createElement('li');
            listItem.setAttribute('data-extension-name', extensionName);

            const span = document.createElement('span');
            span.textContent = extensionName;

            const removeButton = document.createElement('button');
            removeButton.className = 'btn btn-danger btn-sm';
            removeButton.type = 'button';
            removeButton.textContent = 'Remover';

            // Evento para remover o nome da lista
            removeButton.addEventListener('click', function () {
                listItem.remove();
                saveAllowedExtensions();
            });

            listItem.appendChild(span);
            listItem.appendChild(removeButton);
            allowedExtensionsList.appendChild(listItem);
        });
    });
}

document.addEventListener('DOMContentLoaded', function () {
    // Verificar se o identificador já está armazenado
    getIdentifier(function (identifier) {
        if (identifier) {
            console.log('Identificador armazenado:', identifier);
            document.getElementById('deviceId').innerText = identifier;
            document.getElementById('identifier').value = identifier; // Exibir no campo de texto
        } else {
            const newIdentifier = generateIdentifier();
            storeIdentifier(newIdentifier);
            storeServicePort(defaultPort);
            storeScriptDelay(defaultDelay);
            storeServerIP(defaultIP);

            document.getElementById('identifier').value = newIdentifier; // Exibir no campo de texto
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        }
    });

    // Carregar as permissões de extensões permitidas
    loadAllowedExtensions();

    // Monitorar mudanças no campo de identificador e salvar automaticamente
    document.getElementById('identifier').addEventListener('input', function () {
        const identifier = this.value.trim();
        if (identifier) {
            storeIdentifier(identifier);
            isChanged = true;
            showReloadButton();
        }
    });

    // Monitorar mudanças nos campos e salvar automaticamente
    document.getElementById('servicePort').addEventListener('input', function () {
        const port = this.value.trim();
        if (port) {
            storeServicePort(port);
            isChanged = true;
            showReloadButton();
            getServerIP(function (ip) {
                checkConnection(ip || defaultIP, port);
            });
        }
    });

    document.getElementById('scriptDelay').addEventListener('input', function () {
        const delay = this.value.trim();
        if (delay !== '') {
            storeScriptDelay(delay);
            isChanged = true;
            showReloadButton();
        }
    });

    document.getElementById('serverIP').addEventListener('input', function () {
        const ip = this.value.trim();
        if (ip) {
            storeServerIP(ip);
            isChanged = true;
            showReloadButton();
            getServicePort(function (port) {
                checkConnection(ip, port || defaultPort);
            });
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

    // Botão para adicionar uma nova extensão permitida
    document.getElementById('addExtensionButton').addEventListener('click', function () {
        const newExtensionName = document.getElementById('newExtensionName').value.trim();
        if (newExtensionName) {
            addExtensionToList(newExtensionName);
            document.getElementById('newExtensionName').value = ''; // Limpar campo de entrada
            isChanged = true;
            showReloadButton();
        } else {
            alert('Por favor, insira um nome de extensão válido.');
        }
    });

    // Botão para enviar o evento de recarregar para todas as abas
    document.getElementById('reloadButton').addEventListener('click', function () {
        if (isChanged) {
            sendReloadEvent();
            isChanged = false;
            this.style.display = 'none';
        }
    });
});
