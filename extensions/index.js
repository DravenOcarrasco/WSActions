const fs = require('fs');
const path = require('path');
const express = require("express");
const ModuleController = (() => {
    // Variáveis globais
    let APP = null;
    let WSIO = null;
    let RL = null;
    const extensionsPath = path.resolve(process.execDir, 'extensions');
    
    const EXTENSIONS = {
        ENABLED: [],
        DISABLED: [],
    };

    const COMMANDS = {
        IO: {},
        CLI: {},
    };

    /**
     * Inicializa o controlador de módulos, definindo o APP e WSIO,
     * criando o diretório de extensões, se necessário, e carregando as extensões.
     * 
     * @param {Object} wsio - Instância do WebSocket IO
     * @param {Object} app - Instância do Express
     */
    const init = (wsio, app, rl) => {
        APP = app;
        WSIO = wsio;
        RL = rl
        createExtensionsDirectory();
        loadExtensions();
    };

    const initIoToSocket = (socket) => {
        for (let EXT of EXTENSIONS["ENABLED"]){
            for (const [event, handler] of Object.entries(EXT.IOEVENTS)) {
                socket.on(`${EXT.NAME}.${event}`, handler._function);
            }
        }
    }

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
                            if (EXT.COMMANDS) {
                                for (const [event, handler] of Object.entries(EXT.COMMANDS)) {
                                    WSIO.on(`${EXT.NAME}.${event}`, handler._function);
                                    if (COMMANDS.CLI[`${EXT.NAME}`] === undefined) {
                                        COMMANDS.CLI[`${EXT.NAME}`] = {};
                                    }
                                    COMMANDS.CLI[`${EXT.NAME}`][`${event}`] = handler;
                                }
                            }
                            if (EXT.IOEVENTS) {
                                for (const [event, handler] of Object.entries(EXT.IOEVENTS)) {
                                    if (COMMANDS.IO[`${EXT.NAME}`] === undefined) {
                                        COMMANDS.IO[`${EXT.NAME}`] = {};
                                    }
                                    COMMANDS.IO[`${EXT.NAME}`][`${event}`] = handler;
                                }
                            }
                        } else {
                            EXTENSIONS.DISABLED.push(EXT);
                        }

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
        
        APP.get(`/extensions`, (req,res)=>{
            res.json(EXTENSIONS)
        });
    };

    return {
        init,
        initIoToSocket,
        EXTENSIONS,
        COMMANDS
    };
})();

module.exports = ModuleController;
