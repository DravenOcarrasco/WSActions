import { Application } from 'express';
import { Server as SocketIoServer, Socket } from 'socket.io';
import readline from 'readline';
import { Commands, Extension } from './types';
import { createStorageProxy, createStorageHandlers, loadStorage, saveStorage } from './storage';
import { createExtensionsDirectory, loadAllExtensions } from './extensionManager';
import { registerStorageHandlers, initIoToSocket as initSocketEvents } from './websocketManager';

const ModuleController = (() => {
    // Global variables
    let APP: Application | null = null;
    let WSIO: SocketIoServer | null = null;
    let RL: readline.Interface | null = null;

    const EXTENSIONS = {
        ENABLED: [] as Extension[],
        DISABLED: [] as Extension[],
    };

    const COMMANDS: Commands = {
        IO: {},
        CLI: {},
    };

    // Create a proxy object to monitor changes and save storage
    const STORAGE = createStorageProxy(() => saveStorage(STORAGE));

    /**
     * Initializes the module controller.
     * 
     * @param wsio - WebSocket IO instance
     * @param app - Express instance
     * @param rl - Readline instance
     */
    function init(wsio: SocketIoServer, app: Application, rl: readline.Interface) {
        APP = app;
        WSIO = wsio;
        RL = rl;

        createExtensionsDirectory();
        loadStorage(STORAGE);
        loadAllExtensions(WSIO, APP, RL, STORAGE, () => saveStorage(STORAGE), EXTENSIONS, COMMANDS);
        registerStorageHandlers(WSIO, createStorageHandlers(STORAGE, () => saveStorage(STORAGE)));
    }

    /**
     * Initializes IO events for a specific socket.
     * 
     * @param socket - Socket instance
     */
    function initIoToSocket(socket: Socket) {
        initSocketEvents(socket, EXTENSIONS.ENABLED);
    }

    return {
        init,
        initIoToSocket,
        registerStorageHandlers,
        get EXTENSIONS() {
            return EXTENSIONS;
        },
        get COMMANDS() {
            return COMMANDS;
        }
    };
})();

export default ModuleController;
