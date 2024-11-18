import fs from 'fs';
import path from 'path';
import express, { Application, Router } from 'express';
import { Server as SocketIoServer } from 'socket.io';
import readline from 'readline';
import { Extension, Commands } from './types';
import { tempExtensionDir } from '../utils/config';

const extensionsPath = path.resolve(process.cwd(), 'extensions');

// Create extensions directory if it doesn't exist
export const createExtensionsDirectory = () => {
    if (!fs.existsSync(extensionsPath)) {
        fs.mkdirSync(extensionsPath, { recursive: true });
    }
    if (!fs.existsSync(tempExtensionDir)) {
        fs.mkdirSync(tempExtensionDir, { recursive: true });
    }
};

const defineExtensionRoutes = (
    APP: Application | null,
    EXT: Extension,
    extensionsPath: string,
    BASENAME: string
) => {
    if (!APP) return;
    
    // Route for client.js
    APP.get(`/ext/${EXT.NAME.replaceAll(' ', '_')}/client`, (req: express.Request, res: express.Response) => {
        let combinedScript = `(function() {\n    const SHARED_CONTEXT = {};\n    const EXTENSION_ID = '${EXT.ID}';\n`;
        let scripts = EXT.WEB_SCRIPTS ?? ['client.js'];
        
        scripts.forEach((scriptName, index) => {
            const filePath = path.resolve(extensionsPath, BASENAME, scriptName);

            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                combinedScript += fileContent;
                combinedScript += `\n`;
            } else {
                return res.status(404).send(`${scriptName} not found`);
            }

            if (index === scripts.length - 1) {
                combinedScript += '})();';
                res.setHeader('Content-Type', 'application/javascript');
                res.send(combinedScript);
            }
        });
    });

    // Static resources route
    APP.use(`/ext/${EXT.NAME.replaceAll(' ', '_')}/resources`, express.static(path.join(extensionsPath, BASENAME, 'resources')));

    // Icon route
    APP.get(`/ext/${EXT.NAME.replaceAll(' ', '_')}/icon`, (req: express.Request, res: express.Response) => {
        const filePath = path.resolve(extensionsPath, BASENAME, 'icon.png');
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.status(500).send(`${filePath} not found`);
            } else {
                const base64Image = Buffer.from(data).toString('base64');
                res.send(`data:image/png;base64,${base64Image}`);
            }
        });
    });

    // Use extension router
    APP.use(`/ext/${EXT.NAME.replaceAll(' ', '_')}`, EXT.ROUTER);
};

const isDirectoryWithMeta = (extensionPath: string, metaPath: string): boolean =>
    fs.statSync(extensionPath).isDirectory() && fs.existsSync(metaPath);

const requireExtensionModule = (extensionPath: string, extensionDir: string) => {
    try {
        const module = require(extensionPath);
        if (typeof module !== 'function') {
            console.error(`Invalid extension: ${extensionDir}`);
            return null;
        }
        return module;
    } catch (error) {
        console.error(`Error loading extension module ${extensionDir}: ${error}`);
        return null;
    }
};

const loadMetaData = (file_path: string) => {
    try {
        const META_JSON = JSON.parse(fs.readFileSync(file_path, 'utf-8'));
        return META_JSON;
    } catch {
        return {};
    }
};

const createDefaultExtension = (extensionPath: string): Extension => ({
    NAME: 'unknown',
    ENABLED: false,
    IOEVENTS: {},
    COMMANDS: {},
    ROUTER: express.Router(),
    onInitialize: () => { },
    WEB_SCRIPTS: [],
    EXTENSION_PATH: extensionPath,
    ID: ""
});

const configureCommands = (extension: Extension, COMMANDS: Commands, WSIO: SocketIoServer | null) => {
    for (const [event, handler] of Object.entries(extension.COMMANDS)) {
        WSIO?.on(`${extension.NAME}.${event}`, handler._function);
        COMMANDS.CLI[extension.NAME] ||= {};
        COMMANDS.CLI[extension.NAME][event] = handler;
    }
};

const configureIOEvents = (extension: Extension, COMMANDS: Commands) => {
    for (const [event, handler] of Object.entries(extension.IOEVENTS)) {
        COMMANDS.IO[extension.NAME] ||= {};
        COMMANDS.IO[extension.NAME][event] = handler;
    }
};

const handleExtensionError = (extension: Extension, EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] }, extensionDir: string, error: Error) => {
    console.error(`Error loading extension ${extensionDir}: ${error}`);
    extension.ENABLED = false;
    EXTENSIONS.DISABLED.push(extension);
    extension.onError?.(error);
};

const processExtension = (extension: Extension, EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] }, STORAGE: Record<string, any>, COMMANDS: Commands, WSIO: SocketIoServer | null) => {
    if (extension.ENABLED) {
        extension.onInitialize();
        EXTENSIONS.ENABLED.push(extension);
        STORAGE[extension.NAME] ||= {};

        if (extension.COMMANDS) {
            configureCommands(extension, COMMANDS, WSIO);
        }

        if (extension.IOEVENTS) {
            configureIOEvents(extension, COMMANDS);
        }
    } else {
        EXTENSIONS.DISABLED.push(extension);
    }
};

export const loadExtensionsFromDirectory = (
    directoryPath: string,
    WSIO: SocketIoServer | null,
    APP: Application | null,
    RL: readline.Interface | null,
    STORAGE: Record<string, any>,
    saveStorage: () => void,
    EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] },
    COMMANDS: Commands,
    expressInstance: any
) => {
    if (!fs.existsSync(directoryPath)) return;

    fs.readdirSync(directoryPath).forEach(extensionDir => {
        const extensionPath = path.join(directoryPath, extensionDir);
        const metaPath = path.join(extensionPath, "meta.json");

        if (isDirectoryWithMeta(extensionPath, metaPath)) {
            const BASENAME = path.basename(extensionPath);
            const extensionModule = requireExtensionModule(extensionPath, extensionDir);
        
            if (!extensionModule) return;
        
            const metadata = loadMetaData(metaPath);
            const WEB_SCRIPTS = metadata?.WEB_SCRIPTS || ['client.js'];
            let extension = createDefaultExtension(extensionPath);
        
            try {
                extension = extensionModule({
                    WSIO, 
                    APP, 
                    RL, 
                    STORAGE: { data: STORAGE, save: saveStorage },
                    EXPRESS: expressInstance, 
                    WEB_SCRIPTS, 
                    EXTENSION_PATH: extensionPath,
                    ID: metadata.id!
                });
                processExtension(extension, EXTENSIONS, STORAGE, COMMANDS, WSIO);
                defineExtensionRoutes(APP, extension, directoryPath, BASENAME);
            } catch (error: any) {
                console.warn(`Failed to load extension with new format. Trying compatibility mode.`);
        
                try {
                    extension = extensionModule(WSIO, APP, RL, { data: STORAGE, save: saveStorage }, expressInstance, WEB_SCRIPTS, extensionPath);
                    processExtension(extension, EXTENSIONS, STORAGE, COMMANDS, WSIO);
                    defineExtensionRoutes(APP, extension, directoryPath, BASENAME);
                } catch (compatError: any) {
                    handleExtensionError(extension, EXTENSIONS, extensionDir, compatError);
                }
            }
        }
    });
};

export const loadAllExtensions = (
    WSIO: SocketIoServer | null,
    APP: Application | null,
    RL: readline.Interface | null,
    STORAGE: Record<string, any>,
    saveStorage: () => void,
    EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] },
    COMMANDS: Commands
) => {
    loadExtensionsFromDirectory(extensionsPath, WSIO, APP, RL, STORAGE, saveStorage, EXTENSIONS, COMMANDS, express);
    loadExtensionsFromDirectory(tempExtensionDir, WSIO, APP, RL, STORAGE, saveStorage, EXTENSIONS, COMMANDS, express);

    if (APP) {
        APP.get(`/extensions`, (req: express.Request, res: express.Response) => {
            res.json({
                ENABLED: EXTENSIONS.ENABLED,
                DISABLED: EXTENSIONS.DISABLED
            });
        });
    }
};
