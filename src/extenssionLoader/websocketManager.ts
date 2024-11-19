import { Server as SocketIoServer, Socket } from 'socket.io';
import { Extension, StorageHandlers } from './types';

export const registerStorageHandlers = (
    WSIO: SocketIoServer | null,
    storageHandlers: StorageHandlers
) => {
    if (!WSIO) return;

    WSIO.on('connection', (socket: Socket) => {
        socket.on('storage.store', (data) => {
            storageHandlers.save(data);
            socket.emit(data.response, { success: true });
        });

        socket.on('storage.load', (data) => {
            const value = storageHandlers.load(data);
            if (value === undefined) {
                socket.emit(data.response, { success: false });
            } else {
                socket.emit(data.response, { success: true, value });
            }
        });

        socket.on('storage.delete', (data) => {
            storageHandlers.delete(data);
            socket.emit(data.response, { success: true });
        });
    });
};

export const initIoToSocket = (socket: Socket, EXTENSIONS: Extension[]) => {
    // Get `id` from handshake
    var { id } = socket.handshake.query;
    if(
        !id ||
        id === ""
    ) {
        id = "ALL";
    }
    socket.join([id as string]);
    
    // Initialize IO events specific to the socket
    EXTENSIONS.forEach(EXT => {
        Object.entries(EXT.IOEVENTS).forEach(([event, handler]) => {
            socket.on(`${event}`, handler._function);
        });
    });
};
