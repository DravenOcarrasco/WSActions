const fs = require('fs');
const path = require('path');
const express = require("express");

const ModuleController = (() => {
    // Variáveis globais
    let APP = null;
    let WSIO = null;
    let RL = null;
    const extensionsPath = path.resolve(process.cwd(), 'extensions');
    const storagePath = path.resolve(process.cwd(), 'storage.json'); // Path for storage file
    
    const EXTENSIONS = {
        ENABLED: [],
        DISABLED: [],
    };

    const COMMANDS = {
        IO: {},
        CLI: {},
    };

    // Cria um objeto proxy para monitorar mudanças e salvar o armazenamento
    const STORAGE = new Proxy({}, {
        set(target, key, value) {
            target[key] = value;
            saveStorage();
            return true;
        },
        deleteProperty(target, key) {
            delete target[key];
            saveStorage();
            return true;
        }
    });

    /**
     * Inicializa o controlador de módulos, definindo o APP e WSIO,
     * criando o diretório de extensões, se necessário, e carregando as extensões.
     * 
     * @param {Object} wsio - Instância do WebSocket IO
     * @param {Object} app - Instância do Express
     * @param {Object} rl - Instância do Readline
     */
    const init = (wsio, app, rl) => {
        APP = app;
        WSIO = wsio;
        RL = rl;
        createExtensionsDirectory();
        loadStorage();
        loadExtensions();
        registerStorageHandlers(WSIO); // Register storage handlers
    };

    const initIoToSocket = (socket) => {
        for (let EXT of EXTENSIONS["ENABLED"]){
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

    /**
     * Carrega todas as extensões dinamicamente a partir do diretório de extensões.
     * Para cada extensão, inicializa, registra eventos IO e adiciona rotas Express.
     */
    const loadExtensions = () => {
        // Verificar se o diretório EXTENSIONS existe
        if (!fs.existsSync(extensionsPath)) {
            console.error(`Diretório não encontrado: ${extensionsPath}`);
            return;
        }

        // Carregar todas as extensões dinamicamente
        fs.readdirSync(extensionsPath).forEach(extensionDir => {
            const extensionPath = path.join(extensionsPath, extensionDir);
            if (fs.statSync(extensionPath).isDirectory()) {
                const extensionModule = require(extensionPath);
                if (typeof extensionModule === 'function') {
                    let EXT = {};
                    try {
                        EXT = extensionModule(WSIO, APP, RL, express);
                        console.log(`Extensão carregada: ${EXT.NAME}`);
                    
                        if (EXT.ENABLED) {
                            EXT.onInitialize();
                            EXTENSIONS.ENABLED.push(EXT);
                            // Criar registro no armazenamento para a extensão
                            if (!STORAGE[EXT.NAME]) {
                                STORAGE[EXT.NAME] = {};
                            }
                            if (EXT.COMMANDS) {
                                for (const [event, handler] of Object.entries(EXT.COMMANDS)) {
                                    WSIO.on(`${EXT.NAME}.${event}`, handler._function);
                                    if (!COMMANDS.CLI[EXT.NAME]) {
                                        COMMANDS.CLI[EXT.NAME] = {};
                                    }
                                    COMMANDS.CLI[EXT.NAME][event] = handler;
                                }
                            }
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
                        APP.get(`/${EXT.NAME}/client`, (req, res) => {
                            const filePath = path.resolve(process.cwd(), 'extensions', EXT.NAME, './client.js'); // Ajuste o caminho conforme necessário
                            res.sendFile(filePath, (err) => {
                                if (err) {
                                    res.status(500).send(`${filePath} not found`);
                                }
                            });
                        });

                        APP.get(`/${EXT.NAME}/icon`, (req, res) => {
                            const filePath = path.resolve(process.cwd(), 'extensions', EXT.NAME, './icon.png'); // Ajuste o caminho conforme necessário
                            res.sendFile(filePath, (err) => {
                                if (err) {
                                    res.status(500).send(`${filePath} not found`);
                                }
                            });
                        });

                        APP.use(`/${EXT.NAME}`, EXT.ROUTER);
                    } catch (error) {
                        console.error(error);
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

        console.log('Extensões habilitadas:', EXTENSIONS.ENABLED.map(ext => ext.NAME));
        console.log('Extensões desabilitadas:', EXTENSIONS.DISABLED.map(ext => ext.NAME));
        
        APP.get(`/extensions`, (req, res) => {
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
        fs.writeFileSync(storagePath, JSON.stringify(STORAGE, null, 2), 'utf8');
    };

    // Função utilitária para acessar ou criar uma estrutura de dados aninhada
    const setNestedValue = (obj, keys, value) => {
        const lastKey = keys.pop();
        const lastObj = keys.reduce((obj, key) => 
            obj[key] = obj[key] || {}, obj); 
        lastObj[lastKey] = value;
        saveStorage(); // Salva o armazenamento após definir o valor
    };

    const getNestedValue = (obj, keys) => {
        return keys.reduce((obj, key) => 
            (obj && obj[key] !== 'undefined') ? obj[key] : undefined, obj);
    };

    const deleteNestedValue = (obj, keys) => {
        const lastKey = keys.pop();
        const lastObj = keys.reduce((obj, key) => 
            obj[key] = obj[key] || {}, obj);
        delete lastObj[lastKey];
        saveStorage(); // Salva o armazenamento após deletar o valor
    };

    // Handlers for WebSocket events
    const storageHandlers = {
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
    const registerStorageHandlers = (wsio) => {
        wsio.on('connection', (socket) => {
            socket.on('storage.store', (data) => {
                storageHandlers.save(data);
                socket.emit(data.response, { success: true });
            });

            socket.on('storage.load', (data) => {
                const value = storageHandlers.load(data);
                socket.emit(data.response, { success: true, value });
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

module.exports = ModuleController;
