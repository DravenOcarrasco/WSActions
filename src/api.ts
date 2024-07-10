import express, { Application } from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIoServer, Socket } from 'socket.io';
import readline from 'readline';
import cors from 'cors';
import ModuleController from '../extensions';  // Verifique se o caminho para este módulo está correto

// Definir o diretório de execução
const execPath = process.execPath;
const execDir = execPath.includes("bun.exe") || execPath.includes("node.exe")
    ? path.dirname(__dirname)
    : path.dirname(execPath);

const PORT_WS_HTTP = 9514;

console.log(`EXT_PATH: ${path.resolve(execDir, 'extensions')}`);

// Inicializando o Express
const app: Application = express();
app.use(cors());

// Servir arquivos estáticos
app.use(express.static(path.join(execDir, "public")));

// Inicializando servidores HTTP para WebSocket
const httpServerWS = http.createServer(app);

// Inicializando o Socket.IO para ambos os servidores
const io = new SocketIoServer(httpServerWS, {
    cors: {
        origin: '*' // Permitindo acesso de qualquer origem (CORS)
    }
});

const connectedClients = new Set<Socket>(); // Usando Set para armazenar clientes conectados

io.on('connection', (socket) => {
    connectedClients.add(socket);
    ModuleController.initIoToSocket(socket);
    socket.on('disconnect', () => {
        connectedClients.delete(socket);
    });
});

// Iniciando os servidores WebSocket
httpServerWS.listen(PORT_WS_HTTP, () => {
    console.log(`HTTP Server is running on http://127.0.0.1:${PORT_WS_HTTP}`);
});

// Interface de linha de comando (CLI) para enviar comandos
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ModuleController.init(io, app, rl);

var ExtenssionsMenu: any = {}

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
        for (const [event, command] of Object.entries(commands)) {
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
            if (ExtenssionsMenu[option] == undefined) {
                console.log('Opção inválida. Tente novamente.');
                showMenu();
            } else {
                ExtenssionsMenu[option]()
                break;
            }
    }
});

showMenu();

export default httpServerWS