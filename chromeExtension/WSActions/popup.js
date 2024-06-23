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

// Função para verificar a conexão com o serviço
function checkConnection(port) {
    const url = `http://127.0.0.1:${port}/client.js`;
    fetch(url)
        .then(response => {
            if (response.ok) {
                document.getElementById('status').innerText = 'Conectado';
                document.getElementById('status').classList.remove('text-danger');
                document.getElementById('status').classList.add('text-success');
                console.log('client.js carregado com sucesso');
            } else {
                throw new Error('Erro ao carregar client.js');
            }
        })
        .catch(error => {
            document.getElementById('status').innerText = 'Desconectado';
            document.getElementById('status').classList.remove('text-success');
            document.getElementById('status').classList.add('text-danger');
            console.error(error.message);
        });
}

document.addEventListener('DOMContentLoaded', function () {
    // Verificar se o identificador já está armazenado
    getIdentifier(function (identifier) {
        if (identifier) {
            console.log('Identificador armazenado:', identifier);
            document.getElementById('deviceId').innerText = identifier;
        } else {
            const newIdentifier = generateIdentifier();
            storeIdentifier(newIdentifier);
            document.getElementById('deviceId').innerText = newIdentifier;
            console.log('Novo identificador gerado e armazenado:', newIdentifier);
        }
    });

    // Botão para salvar a porta do serviço
    document.getElementById('savePort').addEventListener('click', function () {
        const port = document.getElementById('servicePort').value;
        if (port) {
            storeServicePort(port);
            alert('Porta do serviço salva: ' + port);
            checkConnection(port);
            // Recarregar a página após salvar a porta
            location.reload();
        } else {
            alert('Por favor, insira uma porta válida.');
        }
    });

    // Botão para salvar o atraso do script
    document.getElementById('saveDelay').addEventListener('click', function () {
        const delay = document.getElementById('scriptDelay').value;
        if (delay !== '') {
            storeScriptDelay(delay);
            alert('Atraso do script salvo: ' + delay + ' ms');
        } else {
            alert('Por favor, insira um atraso válido.');
        }
    });

    // Carregar a porta do serviço armazenada no input ao carregar a página
    getServicePort(function (port) {
        if (port) {
            document.getElementById('servicePort').value = port;
            checkConnection(port);
        }
    });

    // Carregar o atraso do script armazenado no input ao carregar a página
    getScriptDelay(function (delay) {
        if (delay) {
            document.getElementById('scriptDelay').value = delay;
        }
    });
});
