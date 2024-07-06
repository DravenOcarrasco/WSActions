import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client';

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
            resolve(io);
        } catch (error: any) {
            // console.error(`Failed to start WebSocket server: ${error.message}`);
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
    const clientSocket: ClientSocket = SocketIOClient(`ws://localhost:${port}`);

    await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
            clientSocket.close();
            reject(new Error('Connection timed out'));
        }, 3000);

        clientSocket.on('connect', () => {
            clearTimeout(timeout);
            clientSocket.emit(event, data);
            clientSocket.close();
            resolve();
        });

        clientSocket.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    }).catch(error => {
        throw error;
    });
}
