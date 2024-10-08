import fs from 'fs';
import path from 'path';
import express, { Application, Router } from 'express';
import { Server as SocketIoServer, Socket } from 'socket.io';
import os from 'os'
import readline from 'readline';
import { tempExtensionDir } from '../src/utils/config';

// Definir o diretório de execução
const execPath = process.execPath;
const execDir = execPath.includes("bun.exe") || execPath.includes("node.exe")
    ? path.dirname(__dirname)
    : path.dirname(execPath);

const extensionsPath = path.resolve(process.cwd(), 'extensions');
const storagePath = path.resolve(process.cwd(), 'storage.json'); // Path for storage file

// Verificar se a pasta existe, se não, criar a pasta
if (!fs.existsSync(tempExtensionDir)) {
    fs.mkdirSync(tempExtensionDir, { recursive: true });
} else {}


interface Extension {
    NAME: string;
    ENABLED: boolean;
    IOEVENTS: Record<string, { _function: (...args: any[]) => void }>;
    COMMANDS: Record<string, { _function: (...args: any[]) => void; description: string }>;
    ROUTER: Router;
    onInitialize: () => void;
    onError?: (error: any) => void;
}

interface Command {
    [key: string]: { _function: (...args: any[]) => void; description?: string };
}

interface Commands {
    IO: Record<string, Command>;
    CLI: Record<string, Command>;
}

interface StorageHandlers {
    save: (data: any) => void;
    load: (data: any) => any;
    delete: (data: any) => void;
}

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
    const STORAGE = new Proxy({}, {
        set(target: any, key: any, value) {
            target[key] = value;
            saveStorage();
            return true;
        },
        deleteProperty(target: any, key: any) {
            delete target[key];
            saveStorage();
            return true;
        }
    });

    /**
     * Inicializa o controlador de módulos, definindo o APP e WSIO,
     * criando o diretório de extensões, se necessário, e carregando as extensões.
     * 
     * @param wsio - Instância do WebSocket IO
     * @param app - Instância do Express
     * @param rl - Instância do Readline
     */
    const init = (wsio: SocketIoServer, app: Application, rl: readline.Interface) => {
        APP = app;
        WSIO = wsio;
        RL = rl;
        createExtensionsDirectory();
        loadStorage();
        loadAllExtensions();
        registerStorageHandlers(WSIO); // Register storage handlers
    };

    const initIoToSocket = (socket: Socket) => {
        for (const EXT of EXTENSIONS.ENABLED) {
            for (const [event, handler] of Object.entries(EXT.IOEVENTS)) {
                socket.on(`${EXT.NAME}.${event}`, handler._function);
            }
        }
    };

    /**
     * Cria o diretório de extensões se ele não existir.
     */
    const createExtensionsDirectory = () => {
        if (!fs.existsSync(extensionsPath)) {
            fs.mkdirSync(extensionsPath, { recursive: true });
            console.log(`Diretório criado: ${extensionsPath}`);
        }
    };

    const loadExtensionsFromDirectory = (
        extensionsPath: string, 
        WSIO: any, 
        APP: any, 
        RL: any, 
        STORAGE: Storage, 
        saveStorage: () => void, 
        EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] }, 
        COMMANDS: { CLI: Record<string, any>, IO: Record<string, any> },
        express: any
    ) => {
        if (!fs.existsSync(extensionsPath)) return;
        fs.readdirSync(extensionsPath).forEach(extensionDir => {
            const extensionPath = path.join(extensionsPath, extensionDir);
            if (fs.statSync(extensionPath).isDirectory() && fs.existsSync(path.join(extensionPath, "meta.json"))) {
                const extensionModule = require(extensionPath);
                if (typeof extensionModule === 'function') {
                    let EXT: Extension = {} as Extension;
                    try {
                        EXT = extensionModule(WSIO, APP, RL, { data: STORAGE, save: saveStorage }, express);
                        if (EXT.ENABLED) {
                            EXT.onInitialize();
                            EXTENSIONS.ENABLED.push(EXT);
    
                            // Criar registro no armazenamento para a extensão
                            if (!STORAGE[EXT.NAME]) {
                                STORAGE[EXT.NAME] = {};
                            }
    
                            // Configurar comandos
                            if (EXT.COMMANDS) {
                                for (const [event, handler] of Object.entries(EXT.COMMANDS)) {
                                    WSIO?.on(`${EXT.NAME}.${event}`, handler._function);
                                    if (!COMMANDS.CLI[EXT.NAME]) {
                                        COMMANDS.CLI[EXT.NAME] = {};
                                    }
                                    COMMANDS.CLI[EXT.NAME][event] = handler;
                                }
                            }
    
                            // Configurar eventos IO
                            if (EXT.IOEVENTS) {
                                for (const [event, handler] of Object.entries(EXT.IOEVENTS)) {
                                    if (!COMMANDS.IO[EXT.NAME]) {
                                        COMMANDS.IO[EXT.NAME] = {};
                                    }
                                    COMMANDS.IO[EXT.NAME][event] = handler;
                                }
                            }
                        } else {
                            EXTENSIONS.DISABLED.push(EXT);
                        }
    
                        // Define a rota para retornar o arquivo client.js
                        APP?.get(`/ext/${EXT.NAME}/client`, (req:any, res:any) => {
                            const filePath = path.resolve(extensionsPath, EXT.NAME, './client.js');
                            res.sendFile(filePath, (err:any) => {
                                if (err) {
                                    res.status(500).send(`${filePath} not found`);
                                }
                            });
                        });
    
                        // Define a rota para retornar o ícone
                        APP?.get(`/ext/${EXT.NAME}/icon`, (req:any, res:any) => {
                            const filePath = path.resolve(extensionsPath, EXT.NAME, 'icon.png');
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
                        APP?.use(`/ext/${EXT.NAME}`, EXT.ROUTER);
                    } catch (error) {
                        console.error(`Erro ao carregar extensão: ${error}`);
                        EXT.ENABLED = false;
                        EXTENSIONS.DISABLED.push(EXT);
                        if (EXT.onError) {
                            EXT.onError(error);
                        }
                    }
                } else {
                    console.error(`Extensão inválida: ${extensionDir}`);
                }
            }
        });
    };

    // Exemplo de uso para carregar extensões de dois diretórios
    const loadAllExtensions = () => {
        const extensionsPath = path.join(process.cwd(), 'extensions');

        loadExtensionsFromDirectory(extensionsPath, WSIO, APP, RL, STORAGE, saveStorage, EXTENSIONS, COMMANDS, express);
        loadExtensionsFromDirectory(tempExtensionDir, WSIO, APP, RL, STORAGE, saveStorage, EXTENSIONS, COMMANDS, express);

        APP?.get(`/extensions`, (req, res) => {
            res.json(EXTENSIONS);
        });
    };

    /**
     * Carrega o armazenamento do arquivo de armazenamento.
     */
    const loadStorage = () => {
        if (fs.existsSync(storagePath)) {
            const data = fs.readFileSync(storagePath, 'utf8');
            const loadedStorage = JSON.parse(data);
            Object.keys(loadedStorage).forEach(key => {
                STORAGE[key] = loadedStorage[key];
            });
        } else {
            saveStorage();
        }
    };

    /**
     * Salva o armazenamento no arquivo de armazenamento.
     */
    const saveStorage = () => {
        fs.writeFileSync(storagePath, JSON.stringify(STORAGE, null, 4), 'utf8');
    };

    // Função utilitária para acessar ou criar uma estrutura de dados aninhada
    const setNestedValue = (obj: any, keys: string[], value: any) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, obj);
        lastObj[lastKey] = value;
        saveStorage(); // Salva o armazenamento após definir o valor
    };

    const getNestedValue = (obj: any, keys: string[]) => {
        return keys.reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, obj);
    };

    const deleteNestedValue = (obj: any, keys: string[]) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((obj, key) => obj[key] = obj[key] || {}, obj);
        delete lastObj[lastKey];
        saveStorage(); // Salva o armazenamento após deletar o valor
    };

    // Handlers for WebSocket events
    const storageHandlers: StorageHandlers = {
        save: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            setNestedValue(STORAGE, keys, data.value);
        },
        load: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            const value = getNestedValue(STORAGE, keys);
            return value;
        },
        delete: (data) => {
            const keys = [data.extension, data.id, ...data.key.split('.')];
            deleteNestedValue(STORAGE, keys);
        },
    };

    // Register storage handlers to WebSocket events
    const registerStorageHandlers = (wsio: SocketIoServer) => {
        wsio.on('connection', (socket: Socket) => {
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

    return {
        init,
        initIoToSocket,
        registerStorageHandlers,
        EXTENSIONS,
        COMMANDS
    };
})();

export default ModuleController;
