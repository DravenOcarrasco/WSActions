import fs from 'fs';
import path from 'path';
import express, { Application, Router } from 'express';
import { Server as SocketIoServer, Socket } from 'socket.io';
import readline from 'readline';
import { tempExtensionDir } from '../utils/config';

// Definir o diretório de execução
const extensionsPath = path.resolve(process.cwd(), 'extensions');
const storagePath = path.resolve(process.cwd(), 'storage.json'); // Caminho para o arquivo de armazenamento

// Verificar se a pasta de extensões temporárias existe, se não, criar
if (!fs.existsSync(tempExtensionDir)) {
    fs.mkdirSync(tempExtensionDir, { recursive: true });
}

// ///////////////////////////////////////////////////////
// Definição de Interfaces
// ///////////////////////////////////////////////////////

interface Extension {
    NAME: string;
    ENABLED: boolean;
    IOEVENTS: Record<string, { _function: (...args: any[]) => void }>;
    COMMANDS: Record<string, { _function: (...args: any[]) => void; description: string }>;
    ROUTER: Router;
    onInitialize: () => void;
    onError?: (error: any) => void;
    WEB_SCRIPTS: string[],
    EXTENSION_PATH?: string,
    ID: string
}

interface Command {
    _function: (...args: any[]) => void;
    description?: string;
}

interface Commands {
    IO: Record<string, Record<string, Command>>;
    CLI: Record<string, Record<string, Command>>;
}

interface StorageHandlers {
    save: (data: any) => void;
    load: (data: any) => any;
    delete: (data: any) => void;
}

// ///////////////////////////////////////////////////////
// Funções de Gerenciamento de Armazenamento
// ///////////////////////////////////////////////////////

/**
 * Cria um objeto proxy para monitorar mudanças e salvar o armazenamento.
 */
const createStorageProxy = (saveStorage: () => void): Record<string, any> => {
    return new Proxy<Record<string, any>>({}, {
        set(target, key, value) {
            target[key as string] = value;
            saveStorage();
            return true;
        },
        deleteProperty(target, key) {
            delete target[key as string];
            saveStorage();
            return true;
        }
    });
};

/**
 * Funções utilitárias para manipulação de valores aninhados no armazenamento.
 */
const storageUtils = {
    setNestedValue: (obj: Record<string, any>, keys: string[], value: any, saveStorage: () => void) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((acc, key) => acc[key] = acc[key] || {}, obj);
        lastObj[lastKey] = value;
        saveStorage();
    },

    getNestedValue: (obj: Record<string, any>, keys: string[]) => {
        return keys.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
    },

    deleteNestedValue: (obj: Record<string, any>, keys: string[], saveStorage: () => void) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((acc, key) => acc[key] = acc[key] || {}, obj);
        delete lastObj[lastKey];
        saveStorage();
    }
};

// ///////////////////////////////////////////////////////
// Funções de Gerenciamento de Extensões
// ///////////////////////////////////////////////////////

/**
 * Cria o diretório de extensões se ele não existir.
 */
const createExtensionsDirectory = () => {
    if (!fs.existsSync(extensionsPath)) {
        fs.mkdirSync(extensionsPath, { recursive: true });
        // console.log(`Diretório criado: ${extensionsPath}`);
    }
};

/**
 * Define as rotas necessárias para a extensão.
 */
const defineExtensionRoutes = (
    APP: Application | null,
    EXT: Extension,
    extensionsPath: string,
    BASENAME: string
) => {
    if (!APP) return;
    // Rota para retornar o arquivo client.js
    APP.get(`/ext/${EXT.NAME.replaceAll(' ', '_')}/client`, (req: express.Request, res: express.Response) => {
        let combinedScript = `(function() {\n    const SHARED_CONTEXT = {};\n    const EXTENSION_ID = '${EXT.ID}';\n`; // Início da função anônima
        let scripts = EXT.WEB_SCRIPTS ?? ['client.js'];
        // Percorre os scripts definidos em EXT.WEB_SCRIPTS
        scripts.forEach((scriptName, index) => {
            const filePath = path.resolve(extensionsPath, BASENAME, scriptName);

            if (fs.existsSync(filePath)) {
                const fileContent = fs.readFileSync(filePath, 'utf-8');
                combinedScript += fileContent;
                combinedScript += `\n`;
            } else {
                return res.status(404).send(`${scriptName} not found`);
            }

            // Se for o último arquivo, enviar a resposta concatenada
            if (index === scripts.length - 1) {
                combinedScript += '})();'; // Encerra a função anônima
                res.setHeader('Content-Type', 'application/javascript');
                res.send(combinedScript);
            }
        });
    });

    // Rota para recursos estáticos
    APP.use(`/ext/${EXT.NAME.replaceAll(' ', '_')}/resources`, express.static(path.join(extensionsPath, BASENAME, 'resources')));

    // Rota para o ícone da extensão
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

    // Usa o roteador da extensão
    APP.use(`/ext/${EXT.NAME.replaceAll(' ', '_')}`, EXT.ROUTER);
};

/**
 * Carrega todas as extensões de um diretório específico.
 */
const loadExtensionsFromDirectory = (
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
        
            // Primeira tentativa de carregar a extensão com a nova estrutura de parâmetros
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
                console.warn(`Tentativa de carregamento da extensão com o novo formato falhou. Tentando em modo de compatibilidade.`);
        
                // Modo de compatibilidade (segunda tentativa)
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

// Funções auxiliares para simplificar o código

const isDirectoryWithMeta = (extensionPath: string, metaPath: string): boolean =>
    fs.statSync(extensionPath).isDirectory() && fs.existsSync(metaPath);

const requireExtensionModule = (extensionPath: string, extensionDir: string) => {
    try {
        const module = require(extensionPath);
        if (typeof module !== 'function') {
            console.error(`Extensão inválida: ${extensionDir}`);
            return null;
        }
        return module;
    } catch (error) {
        console.error(`Erro ao carregar módulo de extensão ${extensionDir}: ${error}`);
        return null;
    }
};

const loadMetaData = (file_path: string)=>{
    try {
        const META_JSON = JSON.parse(fs.readFileSync(file_path, 'utf-8'));
        return META_JSON;
    } catch {
        return {};
    }
}

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
    console.error(`Erro ao carregar extensão ${extensionDir}: ${error}`);
    extension.ENABLED = false;
    EXTENSIONS.DISABLED.push(extension);
    extension.onError?.(error);
};

/**
 * Carrega todas as extensões de diretórios especificados.
 */
const loadAllExtensions = (
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

    // Rota para listar extensões
    if (APP) {
        APP.get(`/extensions`, (req: express.Request, res: express.Response) => {
            res.json({
                ENABLED: EXTENSIONS.ENABLED,
                DISABLED: EXTENSIONS.DISABLED
            });
        });
    }
};

// ///////////////////////////////////////////////////////
// Funções de Gerenciamento de WebSocket
// ///////////////////////////////////////////////////////

/**
 * Registra os handlers de armazenamento para eventos WebSocket.
 */
const registerStorageHandlers = (
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

// ///////////////////////////////////////////////////////
// ModuleController IIFE
// ///////////////////////////////////////////////////////

const ModuleController = (() => {
    // Variáveis globais
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

    // Cria um objeto proxy para monitorar mudanças e salvar o armazenamento
    const STORAGE = createStorageProxy(saveStorage);

    /**
     * Carrega o armazenamento do arquivo de armazenamento.
     */
    function loadStorage() {
        if (fs.existsSync(storagePath)) {
            const data = fs.readFileSync(storagePath, 'utf8');
            const loadedStorage = JSON.parse(data);
            Object.keys(loadedStorage).forEach(key => {
                STORAGE[key] = loadedStorage[key];
            });
        } else {
            saveStorage();
        }
    }

    /**
     * Salva o armazenamento no arquivo de armazenamento.
     */
    function saveStorage() {
        fs.writeFileSync(storagePath, JSON.stringify(STORAGE, null, 4), 'utf8');
    }

    /**
     * Funções utilitárias para manipulação de armazenamento.
     */
    const storageHandler: StorageHandlers = {
        save: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            storageUtils.setNestedValue(STORAGE, keys, data.value, saveStorage);
        },
        load: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            return storageUtils.getNestedValue(STORAGE, keys);
        },
        delete: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            storageUtils.deleteNestedValue(STORAGE, keys, saveStorage);
        },
    };

    /**
     * Inicializa o controlador de módulos.
     * 
     * @param wsio - Instância do WebSocket IO
     * @param app - Instância do Express
     * @param rl - Instância do Readline
     */
    function init(wsio: SocketIoServer, app: Application, rl: readline.Interface) {
        APP = app;
        WSIO = wsio;
        RL = rl;

        createExtensionsDirectory();
        loadStorage();
        loadAllExtensions(WSIO, APP, RL, STORAGE, saveStorage, EXTENSIONS, COMMANDS);
        registerStorageHandlers(WSIO, storageHandler);
    }

    /**
     * Inicializa eventos IO para um socket específico.
     * 
     * @param socket - Instância do Socket
     */
    function initIoToSocket(socket: Socket) {
        // Obtenha o `id` e `moduleName` do handshake
        var { id } = socket.handshake.query;
        if(!id || id === ""){
            id = "ALL"
        }
        // Inicializa os eventos IO específicos para o socket
        EXTENSIONS.ENABLED.forEach(EXT => {
            Object.entries(EXT.IOEVENTS).forEach(([event, handler]) => {
                socket.on(`${EXT.NAME}.${event}`, handler._function);
            });
        });

        socket.join(id as string)
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
