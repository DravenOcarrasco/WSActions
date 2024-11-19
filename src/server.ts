import http from 'http';
import { loadConfig } from './utils/config';
import { createExpressApp } from './server/express';
import { setupSocketIO } from './server/socket';
import { cliManager } from './server/cli';

const config = loadConfig();

// Inicializando o Express
const app = createExpressApp();

// Inicializando servidor HTTP para WebSocket
const httpServer = http.createServer(app);

// Inicializando o Socket.IO
const io = setupSocketIO(httpServer);

// Iniciando o servidor WebSocket
httpServer.listen(config.http.port, '0.0.0.0', () => {
    console.log(`HTTP Server running at http://127.0.0.1:${config.http.port}`);
});

// Inicializando o CLI
cliManager.init(io, app);

export default httpServer;
