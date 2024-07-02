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
export default httpServerWS