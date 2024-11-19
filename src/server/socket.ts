import http from 'http';
import { Server as SocketIoServer } from 'socket.io';
import ModuleController from '../extenssionLoader';
import { initRelay } from '../modules/relay';

export function setupSocketIO(httpServer: http.Server) {
    const io = new SocketIoServer(httpServer, {
        cors: {
            origin: '*' // Permitindo acesso de qualquer origem (CORS)
        }
    });

    io.on('connection', (socket) => {
        ModuleController.initIoToSocket(socket);
    });

    initRelay(io);

    return io;
}
