import { Application } from 'express';
import { Server as SocketIoServer, Socket } from 'socket.io';
import readline from 'readline';
import { Commands, Extension } from './types';
import { createStorageProxy, createStorageHandlers, loadStorage, saveStorage } from './storage';
import { createExtensionsDirectory, loadAllExtensions } from './extensionManager';
import { registerStorageHandlers, initIoToSocket as initSocketEvents } from './websocketManager';
import { HotReloadManager } from './hotReloadManager';

const ModuleController = (() => {
    // Global variables
    let APP: Application | null = null;
    let WSIO: SocketIoServer | null = null;
    let RL: readline.Interface | null = null;
    let hotReloadManager: HotReloadManager | null = null;

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
        
        let config = {
            APP: APP,
            COMMANDS: COMMANDS,
            EXTENSIONS: EXTENSIONS,
            RL: RL,
            saveStorage: () => saveStorage(STORAGE),
            STORAGE: STORAGE,
            WSIO: WSIO
        }

        createExtensionsDirectory();
        loadStorage(STORAGE);
        loadAllExtensions(config);
        registerStorageHandlers(WSIO, createStorageHandlers(STORAGE, () => saveStorage(STORAGE)));

        // Initialize hot reload manager
        hotReloadManager = new HotReloadManager(config);

        // Start watching all enabled extensions
        hotReloadManager.watchAllExtensions();
    }

    /**
     * Initializes IO events for a specific socket.
     * 
     * @param socket - Socket instance
     */
    function initIoToSocket(socket: Socket) {
        initSocketEvents(socket, EXTENSIONS.ENABLED);
    }

    /**
     * Reloads a specific extension.
     * 
     * @param extensionName - Name of the extension to reload
     */
    async function reloadExtension(extensionName: string): Promise<void> {
        const extension = EXTENSIONS.ENABLED.find(ext => ext.NAME === extensionName);
        if (extension && hotReloadManager) {
            await hotReloadManager.reloadExtension(extension);
        }
    }

    /**
     * Reloads all enabled extensions.
     */
    async function reloadAllExtensions(): Promise<void> {
        if (hotReloadManager) {
            await hotReloadManager.reloadAllExtensions();
        }
    }

    /**
     * Enables or disables hot reloading for a specific extension.
     * 
     * @param extensionName - Name of the extension
     * @param enable - Whether to enable or disable hot reloading
     */
    function toggleHotReload(extensionName: string, enable: boolean): void {
        if (!hotReloadManager) return;

        if (enable) {
            const extension = EXTENSIONS.ENABLED.find(ext => ext.NAME === extensionName);
            if (extension) {
                hotReloadManager.watchExtension(extension);
            }
        } else {
            hotReloadManager.stopWatchingExtension(extensionName);
        }
    }

    /**
     * Enables or disables hot reloading for all extensions.
     * 
     * @param enable - Whether to enable or disable hot reloading
     */
    function toggleAllHotReload(enable: boolean): void {
        if (!hotReloadManager) return;

        if (enable) {
            hotReloadManager.watchAllExtensions();
        } else {
            hotReloadManager.stopWatchingAll();
        }
    }

    return {
        init,
        initIoToSocket,
        registerStorageHandlers,
        reloadExtension,
        reloadAllExtensions,
        toggleHotReload,
        toggleAllHotReload,
        get EXTENSIONS() {
            return EXTENSIONS;
        },
        get COMMANDS() {
            return COMMANDS;
        }
    };
})();

export default ModuleController;
