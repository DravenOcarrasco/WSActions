/**
 * Módulo da extensão.
 * 
 * @param {Object} WSIO - Instância do WebSocket IO.
 * @param {Object} APP - Instância do Express.
 * @param {Object} RL - Instância do Readline.
 * @param {Object} STORAGE - Objeto de armazenamento compartilhado.
 * @param {Object} STORAGE.data - Objeto de armazenamento.
 * @param {Function} STORAGE.save - Função para salvar o armazenamento.
 * @param {Object} EXPRESS - Classe Express.
 * 
 * @returns {Object} - Objeto da extensão.
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
