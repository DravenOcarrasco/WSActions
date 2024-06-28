const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');
const readline = require('readline');
const { execSync } = require('child_process');

// Verificar o executável e definir o diretório de execução
if (process.execPath.indexOf("bun.exe") > 0 || process.execPath.indexOf("node.exe") > 0) {
    process.execDir = path.dirname(__dirname);
} else {
    process.execDir = path.dirname(process.execPath);
}
require('./cli')

const ModuleController = require('../extensions')
const PORT_WS_HTTP = 9514;
const PORT_WS_HTTPS = 9515;
const keyPath = path.resolve(process.execDir, 'key.pem');
const certPath = path.resolve(process.execDir, 'certificate.pem');

console.log(`EXT_PATH: ${path.resolve(process.execDir, 'extensions')}`)

// Função para criar certificados se não existirem
// function generateCertificates() {
//     if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
//         console.log('Certificados não encontrados. Gerando certificados autoassinados...');
//         execSync(`openssl genrsa -out ${keyPath} 2048`);
//         execSync(`openssl req -new -key ${keyPath} -out csr.pem -subj "/CN=localhost"`);
//         execSync(`openssl x509 -req -days 365 -in csr.pem -signkey ${keyPath} -out ${certPath}`);
//         fs.unlinkSync('csr.pem'); // Remover CSR após a criação do certificado
//         console.log('Certificados gerados.');
//     }
// }

// Gerar certificados se necessário
// generateCertificates();

// Inicializando o Express
const app = express();
const cors = require('cors');
app.use(cors());

// Servir arquivos estáticos
app.use(express.static(path.join(process.execDir)));
// Habilitando CORS para todas as rotas
app.use(cors());

// Inicializando servidores HTTP e HTTPS para WebSocket
const httpServerWS = http.createServer(app);
// const httpsOptionsWS = {
//     key: fs.readFileSync(keyPath),
//     cert: fs.readFileSync(certPath),
// };
// const httpsServerWS = https.createServer(httpsOptionsWS, app);

// Inicializando o Socket.IO para ambos os servidores
const io = socketIo({
    cors: {
        origin: '*' // Permitindo acesso de qualquer origem (CORS)
    }
});
io.attach(httpServerWS);
// io.attach(httpsServerWS);

const connectedClients = new Set(); // Usando Set para armazenar clientes conectados

io.on('connection', (socket) => {
    connectedClients.add(socket);
    ModuleController.initIoToSocket(socket)
    socket.on('disconnect', () => {
        connectedClients.delete(socket);
    });
});

// Iniciando os servidores WebSocket
httpServerWS.listen(PORT_WS_HTTP, () => {
    console.log(`HTTP Server is running on http://127.0.0.1:${PORT_WS_HTTP}`);
});

// httpsServerWS.listen(PORT_WS_HTTPS, () => {
//     console.log(`HTTPS Server is running on http://127.0.0.1:${PORT_WS_HTTPS}`);
// });

// Interface de linha de comando (CLI) para enviar comandos
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ModuleController.init(io, app, rl)

var ExtenssionsMenu = {}

function showMenu() {
    let menuText = `
    Escolha uma opção:
    1. Listar clientes conectados
    2. Sair
    `;

    ExtenssionsMenu = {}
    // Adicionar comandos das extensões ao menu
    let optionNumber = 3;
    for (const [extension, commands] of Object.entries(ModuleController.COMMANDS.CLI)) {
        for (const [event, command] of Object.entries(commands)){
            menuText += `${optionNumber}. ${extension}.${event}: ${command.description}\n`;
            ExtenssionsMenu[optionNumber] = command._function
            optionNumber++;
        }
        
    }
    console.log(menuText);
    
}

function listConnectedClients() {
    console.log('Clientes conectados:');
    connectedClients.forEach(client => {
        console.log(`- ID: ${client.id}`);
    });
    showMenu();
}



rl.on('line', (input) => {
    const option = input.trim();
    switch (option) {
        case '1':
            listConnectedClients();
            break;
        case '2':
            rl.close();
            break;
        default:
            if(ExtenssionsMenu[option] == undefined){
                console.log('Opção inválida. Tente novamente.');
                showMenu();
            }else{
                ExtenssionsMenu[option]()
                // showMenu()
                break
            }
    }
    ;
});

showMenu();