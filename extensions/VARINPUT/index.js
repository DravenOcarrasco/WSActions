/**
 * Módulo da extensão.
 * 
 * @param {import('socket.io').Server} WSIO - Instância do WebSocket IO.
 * @param {import('express').Application} APP - Instância do Express.
 * @param {import('readline').Interface} RL - Instância do Readline.
 * @param {Object} STORAGE - Objeto de armazenamento compartilhado.
 * @param {Object} STORAGE.data - Objeto que contém os dados de armazenamento.
 * @param {Function} STORAGE.save - Função que salva o armazenamento.
 * @param {typeof import('express')} EXPRESS - Classe Express.
 * 
 * @returns {{ start: Function, stop: Function }} - Objeto da extensão com funções `start` e `stop`.
 */
module.exports = (WSIO, APP, RL, STORAGE, EXPRESS) => {
    const ROUTER = EXPRESS.Router();
    const NAME = "VARINPUT";
    const ENABLED = true;

    const IOEVENTS = {
        "request:variables": {
            description: "Requisita a lista de variáveis armazenadas",
            _function: (data) => {
                const storageData = getStorageData();
                WSIO.emit(`${NAME}:variables`, storageData);
            }
        }
    };

    const COMMANDS = {};

    const onInitialize = () => {
        console.log(`${NAME} initialized.`);
    };

    const onError = (error) => {
        console.error(`${NAME} error: ${error.message}`);
    };

    /**
     * Função para obter os dados do storage.
     * 
     * @returns {Object} - Dados do storage.
     */
    const getStorageData = () => {
        return STORAGE.data;
    };

    const CLIENT_LINK = `${NAME}/client`;

    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        onInitialize,
        onError,
        getStorageData // Adiciona a função getStorageData ao objeto retornado
    };
};
