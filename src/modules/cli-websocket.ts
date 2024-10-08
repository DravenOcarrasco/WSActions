import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer, Server as HttpServer } from 'http';
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client';
import ChromeManager from '../chromeManager';

export var io: SocketIOServer | null = null;

export async function startWebSocketServer(): Promise<SocketIOServer | null> {
    return new Promise((resolve, reject) => {
        try {
            const httpServer = createServer();
            io = new SocketIOServer(httpServer, {
                cors: {
                    origin: '*',
                },
            });
            io.on('connection', (socket) => {
                socket.on('open-chrome', (data) => {
                    ChromeManager.launchProfilesByName(data.profile);
                });
            });
            resolve(io);
        } catch (error: any) {
            io = null;
            reject(error);
        }
    });
}

export function isWebSocketServerRunning(): boolean {
    return io !== null;
}

export function sendMessageToClients(message: string): void {
    if (io) {
        io.emit('message', message);
    }
}

export async function sendToServer(port: number, event: string, data: any): Promise<void> {
    const clientSocket: ClientSocket = SocketIOClient(`ws://localhost:${port}`, {
        autoConnect: false
    });

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            clientSocket.close();
            reject(new Error('Connection timed out'));
        }, 5000);

        clientSocket.on('connect', () => {
            clearTimeout(timeout);
            clientSocket.emit(event, data);
            setTimeout(()=>{
                clientSocket.close();
                resolve();
            },100)
        });

        clientSocket.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
        clientSocket.connect()
    }).catch(error => {
        throw error;
    });
}

/**
 * Função para criar um servidor WebSocket independente usando Socket.IO.
 * @param {number} port - A porta em que o servidor WebSocket deve ser iniciado.
 * @returns {Promise<{ io: SocketIOServer, server: HttpServer }>} - Retorna a instância do servidor Socket.IO e do servidor HTTP.
 */
export async function createSeparateWebSocketServer(port: number): Promise<{ io: SocketIOServer, server: HttpServer }> {
    return new Promise((resolve, reject) => {
        try {
            // Criar um servidor HTTP separado
            const httpServer = createServer();

            // Inicializar o Socket.IO usando o servidor HTTP
            const io: SocketIOServer = new SocketIOServer(httpServer, {
                cors: {
                    origin: '*', // Permitindo todas as origens (ideal para desenvolvimento)
                },
            });

            // Iniciar o servidor HTTP na porta fornecida
            httpServer.listen(port, () => {
                resolve({ io, server: httpServer }); // Retornar a instância do servidor Socket.IO e HTTP
            });

        } catch (error: any) {
            console.error(`Erro ao iniciar o servidor WebSocket: ${error.message}`);
            reject(error); // Rejeitar a Promise em caso de erro
        }
    });
}