// === Configurações Padrão ===
const DEFAULTS = {
    port: 9514,
    delay: 1000,
    ip: '127.0.0.1',
    allowedExtensionNames: [
        'CHROME-TOOLS'
    ]
};

const PERMISSION_TYPES = {
    DEBUGGER: "debugger",
    PAGE_CONTROL: "page_control",
    KEYBOARD: "keyboard",
    MOUSE: "mouse"
};

// === Estado Global ===
let isChanged = false;

// === Utilitários ===
function generateIdentifier() {
    return Math.random().toString(36).substr(2, 16);
}

// === Funções de UI ===
function showReloadButton() {
    const reloadButton = document.getElementById('reloadButton');
    reloadButton.style.display = 'block';
}

function markAsChanged() {
    isChanged = true;
    showReloadButton();
}

function sendReloadEvent() {
    const event = new CustomEvent('wsActionReloadPage', {});
    document.dispatchEvent(event);
}

function updateStatus(text, classToAdd, logMessage) {
    const statusElement = document.getElementById('status');
    statusElement.innerText = text;
    statusElement.classList.remove('text-danger', 'text-success');
    statusElement.classList.add(classToAdd);
    if (logMessage) console.log(logMessage);
}

// === Storage Operations ===
async function storeData(key, value) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ [key]: value }, () => {
            console.log(`${key} armazenado:`, value);
            resolve();
        });
    });
}

async function getData(key) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(key, (data) => {
            resolve(data[key]);
        });
    });
}

// === Armazenamento Específico ===
async function storeIdentifier(identifier) {
    await storeData('identifier', identifier);
    markAsChanged();
}

async function storeServicePort(port) {
    await storeData('servicePort', port);
    markAsChanged();
}

async function storeScriptDelay(delay) {
    await storeData('scriptDelay', delay);
    markAsChanged();
}

async function storeServerIP(ip) {
    await storeData('serverIP', ip);
    markAsChanged();
}

// === Verificação de Conexão ===
async function checkConnection(ip, port) {
    try {
        const url = `http://${ip}:${port}/client.js`;
        const response = await fetch(url);
        if (response.ok) {
            updateStatus('Conectado', 'text-success', 'client.js carregado com sucesso');
        }
    } catch {
        updateStatus('Desconectado', 'text-danger');
    }
}

// === Gestão de CSP ===
function initializeCSPToggle() {
    const cspToggle = document.getElementById('disableCSP');
    
    chrome.storage.local.get(['disableCSP'], (result) => {
        cspToggle.checked = result.disableCSP !== false;
    });

    cspToggle.addEventListener('change', function() {
        const value = this.checked;
        chrome.storage.local.set({ disableCSP: value }, () => {
            chrome.runtime.sendMessage({
                action: 'toggleCSP',
                value: value
            }, (response) => {
                if (response && response.status === 'success') {
                    console.log('CSP configuração atualizada:', value ? 'desativado' : 'ativado');
                } else {
                    console.error('Erro ao atualizar configuração CSP');
                    this.checked = !value;
                }
            });
        });
    });
}

// === Gestão de Permissões ===
async function storeExtensionPermissions(extensionName, permissions) {
    const data = await getData('extensionsPermissions') || {};
    data[extensionName] = permissions;
    await storeData('extensionsPermissions', data);
    markAsChanged();
}

async function getExtensionPermissions() {
    return await getData('extensionsPermissions') || {};
}

async function getPendingExtensions() {
    return await getData('pendingExtensions') || {};
}

async function removePendingExtension(extensionName) {
    const pendingExtensions = await getPendingExtensions();
    delete pendingExtensions[extensionName];
    await storeData('pendingExtensions', pendingExtensions);
    markAsChanged();
}

async function removeExtension(extensionName) {
    const permissions = await getExtensionPermissions();
    delete permissions[extensionName];
    await storeData('extensionsPermissions', permissions);
    markAsChanged();
}

// === UI Components ===
function createExtensionListItem(extensionName, permissions) {
    const template = document.getElementById('extensionItemTemplate');
    const clone = template.content.cloneNode(true);
    
    const item = clone.querySelector('.list-group-item');
    item.setAttribute('data-extension-name', extensionName);
    
    const nameElement = item.querySelector('.extension-name');
    nameElement.textContent = extensionName;
    
    // Atualiza badges de permissões
    const debuggerBadge = item.querySelector('.debugger-badge');
    const keyboardBadge = item.querySelector('.keyboard-badge');
    const mouseBadge = item.querySelector('.mouse-badge');
    const pageControlBadge = item.querySelector('.page-control-badge');
    
    debuggerBadge.classList.toggle('bg-success', permissions[PERMISSION_TYPES.DEBUGGER]);
    keyboardBadge.classList.toggle('bg-success', permissions[PERMISSION_TYPES.KEYBOARD]);
    mouseBadge.classList.toggle('bg-success', permissions[PERMISSION_TYPES.MOUSE]);
    pageControlBadge.classList.toggle('bg-success', permissions[PERMISSION_TYPES.PAGE_CONTROL]);
    
    // Configura botões
    const editBtn = item.querySelector('.edit-btn');
    editBtn.addEventListener('click', () => showEditPermissionsModal(extensionName, permissions));
    
    const removeBtn = item.querySelector('.remove-btn');
    removeBtn.addEventListener('click', async () => {
        if (confirm(`Remover ${extensionName} e todas suas permissões?`)) {
            await removeExtension(extensionName);
            await loadAllowedExtensions();
        }
    });
    
    return item;
}

function createPendingExtensionItem(extensionName, data) {
    const template = document.getElementById('pendingExtensionTemplate');
    const clone = template.content.cloneNode(true);
    
    const item = clone.querySelector('.list-group-item');
    item.setAttribute('data-extension-name', extensionName);
    
    const nameElement = item.querySelector('.extension-name');
    nameElement.textContent = extensionName;
    
    const permissionsElement = item.querySelector('.requested-permissions');
    permissionsElement.textContent = Array.isArray(data.requestedPermissions) 
        ? data.requestedPermissions.join(', ')
        : Object.keys(data.requestedPermissions).join(', ');
    
    const approveBtn = item.querySelector('.approve-btn');
    approveBtn.addEventListener('click', () => showApprovePermissionsModal(extensionName, data.requestedPermissions));
    
    const denyBtn = item.querySelector('.deny-btn');
    denyBtn.addEventListener('click', async () => {
        if (confirm(`Negar acesso para ${extensionName}?`)) {
            await removePendingExtension(extensionName);
            await loadPendingExtensions();
        }
    });
    
    return item;
}

async function showEditPermissionsModal(extensionName, currentPermissions) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Editar Permissões - ${extensionName}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editDebugger" ${currentPermissions[PERMISSION_TYPES.DEBUGGER] ? 'checked' : ''}>
                        <label class="form-check-label" for="editDebugger">
                            <i class="fas fa-bug"></i> Debugger
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editKeyboard" ${currentPermissions[PERMISSION_TYPES.KEYBOARD] ? 'checked' : ''}>
                        <label class="form-check-label" for="editKeyboard">
                            <i class="fas fa-keyboard"></i> Teclado
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editMouse" ${currentPermissions[PERMISSION_TYPES.MOUSE] ? 'checked' : ''}>
                        <label class="form-check-label" for="editMouse">
                            <i class="fas fa-mouse"></i> Mouse
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editPageControl" ${currentPermissions[PERMISSION_TYPES.PAGE_CONTROL] ? 'checked' : ''}>
                        <label class="form-check-label" for="editPageControl">
                            <i class="fas fa-file"></i> Controle de Páginas
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="savePermissions">Salvar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    
    const saveBtn = modal.querySelector('#savePermissions');
    saveBtn.addEventListener('click', async () => {
        const newPermissions = {
            [PERMISSION_TYPES.DEBUGGER]: modal.querySelector('#editDebugger').checked,
            [PERMISSION_TYPES.KEYBOARD]: modal.querySelector('#editKeyboard').checked,
            [PERMISSION_TYPES.MOUSE]: modal.querySelector('#editMouse').checked,
            [PERMISSION_TYPES.PAGE_CONTROL]: modal.querySelector('#editPageControl').checked
        };
        
        await storeExtensionPermissions(extensionName, newPermissions);
        modalInstance.hide();
        await loadAllowedExtensions();
    });
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
    
    modalInstance.show();
}

async function showApprovePermissionsModal(extensionName, requestedPermissions) {
    const permissions = Array.isArray(requestedPermissions) ? requestedPermissions : Object.keys(requestedPermissions);
    
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Aprovar Permissões - ${extensionName}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>Permissões solicitadas:</p>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="approveDebugger" 
                            ${permissions.includes(PERMISSION_TYPES.DEBUGGER) ? 'checked' : ''}>
                        <label class="form-check-label" for="approveDebugger">
                            <i class="fas fa-bug"></i> Debugger
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="approveKeyboard"
                            ${permissions.includes(PERMISSION_TYPES.KEYBOARD) ? 'checked' : ''}>
                        <label class="form-check-label" for="approveKeyboard">
                            <i class="fas fa-keyboard"></i> Teclado
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="approveMouse"
                            ${permissions.includes(PERMISSION_TYPES.MOUSE) ? 'checked' : ''}>
                        <label class="form-check-label" for="approveMouse">
                            <i class="fas fa-mouse"></i> Mouse
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="approvePageControl"
                            ${permissions.includes(PERMISSION_TYPES.PAGE_CONTROL) ? 'checked' : ''}>
                        <label class="form-check-label" for="approvePageControl">
                            <i class="fas fa-file"></i> Controle de Páginas
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="approvePermissions">Aprovar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    
    const approveBtn = modal.querySelector('#approvePermissions');
    approveBtn.addEventListener('click', async () => {
        const approvedPermissions = {
            [PERMISSION_TYPES.DEBUGGER]: modal.querySelector('#approveDebugger').checked,
            [PERMISSION_TYPES.KEYBOARD]: modal.querySelector('#approveKeyboard').checked,
            [PERMISSION_TYPES.MOUSE]: modal.querySelector('#approveMouse').checked,
            [PERMISSION_TYPES.PAGE_CONTROL]: modal.querySelector('#approvePageControl').checked
        };
        
        await storeExtensionPermissions(extensionName, approvedPermissions);
        await removePendingExtension(extensionName);
        modalInstance.hide();
        await Promise.all([loadPendingExtensions(), loadAllowedExtensions()]);
    });
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
    
    modalInstance.show();
}

async function addExtensionToList(extensionName) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Configurar Permissões - ${extensionName}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="newDebugger">
                        <label class="form-check-label" for="newDebugger">
                            <i class="fas fa-bug"></i> Debugger
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="newKeyboard">
                        <label class="form-check-label" for="newKeyboard">
                            <i class="fas fa-keyboard"></i> Teclado
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="newMouse">
                        <label class="form-check-label" for="newMouse">
                            <i class="fas fa-mouse"></i> Mouse
                        </label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="newPageControl">
                        <label class="form-check-label" for="newPageControl">
                            <i class="fas fa-file"></i> Controle de Páginas
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" id="addWithPermissions">Adicionar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const modalInstance = new bootstrap.Modal(modal);
    
    const addBtn = modal.querySelector('#addWithPermissions');
    addBtn.addEventListener('click', async () => {
        const permissions = {
            [PERMISSION_TYPES.DEBUGGER]: modal.querySelector('#newDebugger').checked,
            [PERMISSION_TYPES.KEYBOARD]: modal.querySelector('#newKeyboard').checked,
            [PERMISSION_TYPES.MOUSE]: modal.querySelector('#newMouse').checked,
            [PERMISSION_TYPES.PAGE_CONTROL]: modal.querySelector('#newPageControl').checked
        };
        
        await storeExtensionPermissions(extensionName, permissions);
        modalInstance.hide();
        await loadAllowedExtensions();
    });
    
    modal.addEventListener('hidden.bs.modal', () => {
        modal.remove();
    });
    
    modalInstance.show();
}

// === Lists Management ===
async function loadAllowedExtensions() {
    const permissions = await getExtensionPermissions();
    const allowedExtensionsList = document.getElementById('allowedExtensionsList');
    allowedExtensionsList.innerHTML = '';
    
    Object.entries(permissions).forEach(([extensionName, extensionPermissions]) => {
        const listItem = createExtensionListItem(extensionName, extensionPermissions);
        allowedExtensionsList.appendChild(listItem);
    });
}

async function loadPendingExtensions() {
    const pendingExtensions = await getPendingExtensions();
    const pendingExtensionsList = document.getElementById('pendingExtensionsList');
    pendingExtensionsList.innerHTML = '';
    
    Object.entries(pendingExtensions).forEach(([extensionName, data]) => {
        const listItem = createPendingExtensionItem(extensionName, data);
        pendingExtensionsList.appendChild(listItem);
    });
}

// === Inicialização ===
async function initializeIdentifier() {
    let identifier = await getData('identifier');
    if (identifier) {
        console.log('Identificador armazenado:', identifier);
        document.getElementById('deviceId').innerText = identifier;
        document.getElementById('identifier').value = identifier;
    } else {
        identifier = generateIdentifier();
        await Promise.all([
            storeIdentifier(identifier),
            storeServicePort(DEFAULTS.port),
            storeScriptDelay(DEFAULTS.delay),
            storeServerIP(DEFAULTS.ip)
        ]);
        document.getElementById('identifier').value = identifier;
        console.log('Novo identificador gerado e armazenado:', identifier);
    }
}

function initializeInputListeners() {
    document.getElementById('identifier').addEventListener('input', async function () {
        const identifier = this.value.trim();
        if (identifier) {
            await storeIdentifier(identifier);
        }
    });

    document.getElementById('servicePort').addEventListener('input', async function () {
        const port = this.value.trim();
        if (port) {
            await storeServicePort(port);
            const ip = await getData('serverIP');
            await checkConnection(ip || DEFAULTS.ip, port);
        }
    });

    document.getElementById('scriptDelay').addEventListener('input', async function () {
        const delay = this.value.trim();
        if (delay !== '') {
            await storeScriptDelay(delay);
        }
    });

    document.getElementById('serverIP').addEventListener('input', async function () {
        const ip = this.value.trim();
        if (ip) {
            await storeServerIP(ip);
            const port = await getData('servicePort');
            await checkConnection(ip, port || DEFAULTS.port);
        }
    });
}

async function initializeStoredValues() {
    const [port, delay, ip] = await Promise.all([
        getData('servicePort'),
        getData('scriptDelay'),
        getData('serverIP')
    ]);

    if (port) {
        document.getElementById('servicePort').value = port;
        await checkConnection(ip || DEFAULTS.ip, port);
    }

    if (delay) {
        document.getElementById('scriptDelay').value = delay;
    }

    if (ip) {
        document.getElementById('serverIP').value = ip;
    }
}

function initializeButtons() {
    document.getElementById('addExtensionButton').addEventListener('click', async () => {
        const newExtensionName = document.getElementById('newExtensionName').value.trim();
        if (newExtensionName) {
            await addExtensionToList(newExtensionName);
            document.getElementById('newExtensionName').value = '';
        } else {
            alert('Por favor, insira um nome de extensão válido.');
        }
    });

    document.getElementById('reloadButton').addEventListener('click', function () {
        if (isChanged) {
            sendReloadEvent();
            isChanged = false;
            this.style.display = 'none';
        }
    });
}

function initializePopup() {
    const proxyModeSelect = document.getElementById('proxyMode');
    const manualProxyConfig = document.getElementById('manualProxyConfig');

    proxyModeSelect.addEventListener('change', function () {
        const selectedMode = proxyModeSelect.value;
        manualProxyConfig.style.display = selectedMode === 'http' || selectedMode === 'https' ? 'block' : 'none';
        chrome.storage.local.set({ proxyMode: selectedMode });
    });

    document.getElementById('proxyIP').addEventListener('input', saveManualProxyConfig);
    document.getElementById('proxyPort').addEventListener('input', saveManualProxyConfig);

    chrome.storage.local.get(['proxyMode', 'proxyIP', 'proxyPort'], (prefs) => {
        proxyModeSelect.value = prefs.proxyMode || 'auto';
        document.getElementById('proxyIP').value = prefs.proxyIP || '';
        document.getElementById('proxyPort').value = prefs.proxyPort || '';
        manualProxyConfig.style.display = proxyModeSelect.value === 'http' || proxyModeSelect.value === 'https' ? 'block' : 'none';
    });
}

function saveManualProxyConfig() {
    const proxyIP = document.getElementById('proxyIP').value;
    const proxyPort = document.getElementById('proxyPort').value;
    chrome.storage.local.set({ proxyIP, proxyPort });
}

// === Start ===
document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
        initializeIdentifier(),
        loadAllowedExtensions(),
        loadPendingExtensions(),
        initializeStoredValues()
    ]);
    
    initializeInputListeners();
    initializeButtons();
    initializePopup();
    initializeCSPToggle();
});
