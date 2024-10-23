// popup.js

// === Configurações Padrão ===
const DEFAULTS = {
    port: 9514,
    delay: 1000,
    ip: '127.0.0.1',
    allowedExtensionNames: [
        'CHROME-TOOLS'
    ]
};

// === Estado Global ===
let isChanged = false;

// === Utilitários ===

// Função para gerar um identificador único
function generateIdentifier() {
    return Math.random().toString(36).substr(2, 16);
}

// Função para armazenar dados usando chrome.storage.sync
function storeData(key, value, message) {
    chrome.storage.sync.set({ [key]: value }, () => {
        console.log(`${message}:`, value);
    });
}

// Função para obter dados do chrome.storage.sync
function getData(key, callback) {
    chrome.storage.sync.get(key, (data) => {
        callback(data[key]);
    });
}

// === Armazenamento Específico ===

function storeIdentifier(identifier) {
    storeData('identifier', identifier, 'Identificador armazenado');
}

function getIdentifier(callback) {
    getData('identifier', callback);
}

function storeServicePort(port) {
    storeData('servicePort', port, 'Porta do serviço armazenada');
}

function getServicePort(callback) {
    getData('servicePort', callback);
}

function storeScriptDelay(delay) {
    storeData('scriptDelay', delay, 'Atraso do script armazenado');
}

function getScriptDelay(callback) {
    getData('scriptDelay', callback);
}

function storeServerIP(ip) {
    storeData('serverIP', ip, 'IP do servidor armazenado');
}

function getServerIP(callback) {
    getData('serverIP', callback);
}

function storePermissionToControl(permissions) {
    storeData('allowedExtensionNames', permissions, 'Permissões atualizadas');
}

function getPermissionToControl(callback) {
    getData('allowedExtensionNames', (data) => callback(data || []));
}

// === Verificação de Conexão ===

function checkConnection(ip, port) {
    const url = `http://${ip}:${port}/client.js`;
    fetch(url)
        .then(response => {
            if (response.ok) {
                updateStatus('Conectado', 'text-success', 'client.js carregado com sucesso');
            }
        })
        .catch(() => {
            updateStatus('Desconectado', 'text-danger');
        });
}

function updateStatus(text, classToAdd, logMessage) {
    const statusElement = document.getElementById('status');
    statusElement.innerText = text;
    statusElement.classList.remove('text-danger', 'text-success');
    statusElement.classList.add(classToAdd);
    if (logMessage) console.log(logMessage);
}

// === Manipulação de Eventos de Recarga ===

function showReloadButton() {
    const reloadButton = document.getElementById('reloadButton');
    reloadButton.style.display = 'block';
}

function sendReloadEvent() {
    const event = new CustomEvent('wsActionReloadPage', {});
    document.dispatchEvent(event);
}

// === Gestão de Extensões Permitidas ===

function addExtensionToList(extensionName) {
    const allowedExtensionsList = document.getElementById('allowedExtensionsList');

    // Verificar se o nome já está na lista
    const exists = Array.from(allowedExtensionsList.children).some(
        item => item.getAttribute('data-extension-name').toLowerCase() === extensionName.toLowerCase()
    );

    if (exists) {
        alert('Este nome de extensão já está na lista de permissões.');
        return;
    }

    const listItem = createExtensionListItem(extensionName);
    allowedExtensionsList.appendChild(listItem);
    saveAllowedExtensions();
}

function createExtensionListItem(extensionName) {
    const listItem = document.createElement('li');
    listItem.setAttribute('data-extension-name', extensionName);

    const span = document.createElement('span');
    span.textContent = extensionName;

    const removeButton = document.createElement('button');
    removeButton.className = 'btn btn-danger btn-sm';
    removeButton.type = 'button';
    removeButton.textContent = 'Remover';
    removeButton.addEventListener('click', () => {
        listItem.remove();
        saveAllowedExtensions();
    });

    listItem.appendChild(span);
    listItem.appendChild(removeButton);
    return listItem;
}

function saveAllowedExtensions() {
    const allowedExtensionsList = document.getElementById('allowedExtensionsList');
    const extensions = Array.from(allowedExtensionsList.children).map(
        item => item.getAttribute('data-extension-name')
    );
    storePermissionToControl(extensions);
}

function loadAllowedExtensions() {
    getPermissionToControl((extensions) => {
        const allowedExtensionsList = document.getElementById('allowedExtensionsList');
        allowedExtensionsList.innerHTML = ''; // Limpar lista antes de carregar

        extensions.forEach(extensionName => {
            const listItem = createExtensionListItem(extensionName);
            allowedExtensionsList.appendChild(listItem);
        });
    });
}

// === Inicialização e Event Listeners ===

document.addEventListener('DOMContentLoaded', () => {
    initializeIdentifier();
    loadAllowedExtensions();
    initializeInputListeners();
    initializeStoredValues();
    initializeButtons();
});

// Inicializa o identificador
function initializeIdentifier() {
    getIdentifier((identifier) => {
        if (identifier) {
            console.log('Identificador armazenado:', identifier);
            document.getElementById('deviceId').innerText = identifier;
            document.getElementById('identifier').value = identifier;
        } else {
            const newIdentifier = generateIdentifier();
            storeIdentifier(newIdentifier);
            storeServicePort(DEFAULTS.port);
            storeScriptDelay(DEFAULTS.delay);
            storeServerIP(DEFAULTS.ip);

            document.getElementById('identifier').value = newIdentifier;
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        }
    });
}

// Inicializa os listeners para os campos de entrada
function initializeInputListeners() {
    // Listener para o identificador
    document.getElementById('identifier').addEventListener('input', function () {
        const identifier = this.value.trim();
        if (identifier) {
            storeIdentifier(identifier);
            markAsChanged();
        }
    });

    // Listener para a porta do serviço
    document.getElementById('servicePort').addEventListener('input', function () {
        const port = this.value.trim();
        if (port) {
            storeServicePort(port);
            markAsChanged();
            getServerIP((ip) => {
                checkConnection(ip || DEFAULTS.ip, port);
            });
        }
    });

    // Listener para o atraso do script
    document.getElementById('scriptDelay').addEventListener('input', function () {
        const delay = this.value.trim();
        if (delay !== '') {
            storeScriptDelay(delay);
            markAsChanged();
        }
    });

    // Listener para o IP do servidor
    document.getElementById('serverIP').addEventListener('input', function () {
        const ip = this.value.trim();
        if (ip) {
            storeServerIP(ip);
            markAsChanged();
            getServicePort((port) => {
                checkConnection(ip, port || DEFAULTS.port);
            });
        }
    });
}

// Marca que houve alterações e exibe o botão de recarregar
function markAsChanged() {
    isChanged = true;
    showReloadButton();
}

// Inicializa os valores armazenados nos campos de entrada
function initializeStoredValues() {
    // Porta do serviço
    getServicePort((port) => {
        if (port) {
            document.getElementById('servicePort').value = port;
            getServerIP((ip) => {
                checkConnection(ip || DEFAULTS.ip, port);
            });
        }
    });

    // Atraso do script
    getScriptDelay((delay) => {
        if (delay) {
            document.getElementById('scriptDelay').value = delay;
        }
    });

    // IP do servidor
    getServerIP((ip) => {
        if (ip) {
            document.getElementById('serverIP').value = ip;
        }
    });
}

// Inicializa os botões de adicionar extensão e recarregar
function initializeButtons() {
    // Botão para adicionar uma nova extensão permitida
    document.getElementById('addExtensionButton').addEventListener('click', () => {
        const newExtensionName = document.getElementById('newExtensionName').value.trim();
        if (newExtensionName) {
            addExtensionToList(newExtensionName);
            document.getElementById('newExtensionName').value = ''; // Limpar campo de entrada
            markAsChanged();
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
}
