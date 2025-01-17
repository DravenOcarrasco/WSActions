import fs from 'fs';
import path from 'path';
import express, { Application, Router } from 'express';
import { Server as SocketIoServer } from 'socket.io';
import readline from 'readline';
import { Extension, Commands, LoadExtensionsConfig, ProcessExtensionConfig, DefineExtensionRoutesConfig, LoadAllExtensionsConfig, ExtensionInitConfig} from './types';
import { tempExtensionDir } from '../utils/config';
import fetch from 'node-fetch';

const extensionsPath = path.resolve(process.cwd(), 'extensions');

// Função para verificar se uma string é uma URL válida
const isValidUrl = (urlString: string): boolean => {
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
};

// Função para carregar conteúdo de uma URL
const fetchUrlContent = async (url: string): Promise<string> => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error fetching script from URL ${url}:`, error);
        return '';
    }
};

// Função para carregar script (URL ou local)
const loadScript = async (scriptName: string, extPath: string, BASENAME: string): Promise<string> => {
    try {
        console.log(extPath)
        if (isValidUrl(scriptName)) {
            const content = await fetchUrlContent(scriptName);
            return content;
        } else {
            const filePath = path.resolve(extPath, scriptName);
            console.log(filePath)
            if (fs.existsSync(filePath)) {
                return fs.readFileSync(filePath, 'utf-8');
            } else {
                console.warn(`Script not found: ${scriptName}`);
                return '';
            }
        }
    } catch (error) {
        console.error(`Error loading script ${scriptName}:`, error);
        return '';
    }
};

// Create extensions directory if it doesn't exist
export const createExtensionsDirectory = () => {
    // Create main extensions directory
    if (!fs.existsSync(extensionsPath)) {
        fs.mkdirSync(extensionsPath, { recursive: true });
    }
    
    // Create temp extensions directory if it doesn't exist
    if (!fs.existsSync(tempExtensionDir)) {
        fs.mkdirSync(tempExtensionDir, { recursive: true });
    }
};

const defineExtensionRoutes = (
    config: DefineExtensionRoutesConfig
) => {
    if (!config.APP) return;
    
    // Route for client.js
    config.APP.get(`/ext/${config.EXT.NAME.replaceAll(' ', '_')}/client`, async (req: express.Request, res: express.Response) => {
        try {
            // Process global scripts
            let global_scripts = config.EXT.GLOBAL_SCRIPTS ?? [];
            let combinedGlobalScript = "";
            for (const scriptName of global_scripts) {
                const content = await loadScript(scriptName, config.EXT.EXTENSION_PATH, config.BASENAME);
                if (content) {
                    combinedGlobalScript += content + '\n';
                    
                }
            }
            // Start the combined script with IIFE and shared context
            let combinedScript = `${combinedGlobalScript}\n(function() {\n    const SHARED_CONTEXT = {};\n    const EXTENSION_ID = '${config.EXT.ID}';\n`;
            
            // Process web scripts
            let scripts = config.EXT.WEB_SCRIPTS ?? ['client.js'];
            for (const scriptName of scripts) {
                const content = await loadScript(scriptName, config.EXT.EXTENSION_PATH, config.BASENAME);
                if (content) {
                    combinedScript += content + '\n';
                } else {
                    return res.status(404).send(`${scriptName} not found or failed to load`);
                }
            }
            
            // Close IIFE
            combinedScript += '})();';
            
            // Send response
            res.setHeader('Content-Type', 'application/javascript');
            res.send(combinedScript);
            
        } catch (error) {
            console.error('Error processing scripts:', error);
            res.status(500).send('Error processing scripts');
        }
    });

    // Static resources route
    config.APP.use(`/ext/${config.EXT.NAME.replaceAll(' ', '_')}/resources`, express.static(path.join(config.EXT.EXTENSION_PATH, 'resources')));

    // Icon route
    config.APP.get(`/ext/${config.EXT.NAME.replaceAll(' ', '_')}/icon`, (req: express.Request, res: express.Response) => {
        const filePath = path.resolve(config.EXT.EXTENSION_PATH, 'icon.png');
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
    config.APP.use(`/ext/${config.EXT.NAME.replaceAll(' ', '_')}`, config.EXT.ROUTER);
};

const isDirectoryWithMeta = (extensionPath: string, metaPath: string): boolean =>
    fs.statSync(extensionPath).isDirectory() && fs.existsSync(metaPath);

const requireExtensionModule = (extensionPath: string, extensionDir: string) => {
    try {
        const module = require(path.join(extensionPath, 'index.js'));
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
    GLOBAL_SCRIPTS: [],
    EXTENSION_PATH: extensionPath,
    ID: ""
});

const configureCommands = (config:ProcessExtensionConfig) => {
    for (const [event, handler] of Object.entries(config.extension.COMMANDS)) {
        config.WSIO?.on(`${config.extension.NAME}.${event}`, handler._function);
        config.COMMANDS.CLI[config.extension.NAME] ||= {};
        config.COMMANDS.CLI[config.extension.NAME][event] = handler;
    }
};

const configureIOEvents = (config: ProcessExtensionConfig) => {
    for (const [event, handler] of Object.entries(config.extension.IOEVENTS)) {
        config.COMMANDS.IO[config.extension.NAME] ||= {};
        config.COMMANDS.IO[config.extension.NAME][event] = handler;
    }
};

const handleExtensionError = (extension: Extension, EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] }, extensionDir: string, error: Error) => {
    console.error(`Error loading extension ${extensionDir}: ${error}`);
    extension.ENABLED = false;
    EXTENSIONS.DISABLED.push(extension);
    extension.onError?.(error);
};

const processExtension = (config:ProcessExtensionConfig) => {
    if (config.extension.ENABLED) {
        config.extension.onInitialize();
        config.EXTENSIONS.ENABLED.push(config.extension);
        config.STORAGE[config.extension.NAME] ||= {};

        if (config.extension.COMMANDS) {
            configureCommands(config);
        }

        if (config.extension.IOEVENTS) {
            configureIOEvents(config);
        }
    } else {
        config.EXTENSIONS.DISABLED.push(config.extension);
    }
};

export const loadExtensionsFromDirectory = (
    config: LoadExtensionsConfig
) => {
    if (!fs.existsSync(config.EXTENSION_PATH)) return;

    fs.readdirSync(config.EXTENSION_PATH).forEach(extensionDir => {
        
        const extensionPath = path.join(config.EXTENSION_PATH, extensionDir);
        const metaPath = path.join(extensionPath, "meta.json");

        if (isDirectoryWithMeta(extensionPath, metaPath)) {
            const BASENAME = path.basename(extensionPath);
            const extensionModule = requireExtensionModule(extensionPath, extensionDir);
        
            if (!extensionModule) return;
        
            const metadata = loadMetaData(metaPath);
            const WEB_SCRIPTS = metadata?.WEB_SCRIPTS || ['client.js'];
            const GLOBAL_SCRIPTS = metadata?.GLOBAL_SCRIPTS || [];
            let extension:Extension = createDefaultExtension(extensionPath);
            try {
                // Try loading with new format first
                const initConfig: ExtensionInitConfig = {
                    WSIO: config.WSIO,
                    APP: config.APP,
                    RL: config.RL,
                    STORAGE: { data: config.STORAGE, save: config.saveStorage },
                    EXPRESS: config.EXPRESS,
                    WEB_SCRIPTS,
                    GLOBAL_SCRIPTS,
                    EXTENSION_PATH: extensionPath,
                    ID: metadata.id || ''
                };
                extension = extensionModule(initConfig);

                processExtension({
                    COMMANDS: config.COMMANDS,
                    EXTENSIONS: config.EXTENSIONS,
                    STORAGE: config.STORAGE,
                    WSIO: config.WSIO,
                    extension: extension,
                });

                defineExtensionRoutes({
                    APP: config.APP,
                    EXT: extension,
                    BASENAME,
                    extensionsPath: config.EXTENSION_PATH
                });
            } catch (error: any) {
                console.error(error);
                console.warn(`Failed to load extension with new format. Trying compatibility mode.`);

                try {
                    // Fallback to old format
                    extension = extensionModule(config.WSIO, config.APP, config.RL, { data: config.STORAGE, save: config.saveStorage }, config.EXPRESS, WEB_SCRIPTS, extensionPath);
                    processExtension({
                        COMMANDS: config.COMMANDS,
                        EXTENSIONS:config.EXTENSIONS,
                        STORAGE: config.STORAGE,
                        WSIO: config.WSIO,
                        extension: extension 
                    });
                    defineExtensionRoutes({
                        APP: config.APP, 
                        EXT:extension, 
                        BASENAME, 
                        extensionsPath:config.EXTENSION_PATH
                    });
                } catch (compatError: any) {
                    handleExtensionError(extension, config.EXTENSIONS, extensionDir, compatError);
                }
            }
        }
    });
};

export const loadAllExtensions = (
    config:LoadAllExtensionsConfig
) => {
    loadExtensionsFromDirectory({
        APP: config.APP,
        COMMANDS: config.COMMANDS,
        EXTENSION_PATH: extensionsPath,
        EXPRESS: express,
        EXTENSIONS: config.EXTENSIONS,
        RL: config.RL,
        saveStorage: config.saveStorage,
        STORAGE: config.STORAGE,
        WSIO: config.WSIO,
    })
    
    loadExtensionsFromDirectory({
        APP: config.APP,
        COMMANDS: config.COMMANDS,
        EXTENSION_PATH: tempExtensionDir,
        EXPRESS: express,
        EXTENSIONS: config.EXTENSIONS,
        RL: config.RL,
        saveStorage: config.saveStorage,
        STORAGE: config.STORAGE,
        WSIO: config.WSIO,
    })

    if (config.APP) {
        config.APP.get(`/extensions`, (req: express.Request, res: express.Response) => {
            res.json({
                ENABLED: config.EXTENSIONS.ENABLED,
                DISABLED: config.EXTENSIONS.DISABLED
            });
        });
    }
};
