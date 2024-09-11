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
    const NAME = "CONNECTION-INFO";
    const ENABLED = true;
    const IOEVENTS = {
        "example:event": {
            description: "Descrição do evento de exemplo",
            _function: (data) => {
                WSIO.emit(`${NAME}:event`, data);
            }
        }
    };
    const COMMANDS = {
    };
    const onInitialize = () => {
        console.log(`${NAME} initialized.`);
    };
    const onError = (error) => {
        console.error(`${NAME} error: ${error.message}`);
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
        onError
    };
};