const fs = require('fs');
const path = require('path');

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
    // Cria um novo roteador para a extensão
    const ROUTER = EXPRESS.Router();
    // Nome da extensão
    const NAME = "TOOLS";
    // Estado de habilitação da extensão
    const ENABLED = true;
    // Definição de eventos IO específicos para esta extensão
    const IOEVENTS = {
        "master:command": {
            description: "Descrição do evento de teste",
            _function: (data) => {
                WSIO.emit(`${NAME}:command`, data);
            }
        }
    };
    const COMMANDS = {
        "openPage": {
            description: "Envia o sinal para os navegadores abrirem a pagina informada",
            _function: (data) => {
                RL.question('Digite a URL da página para abrir: ', (url) => {
                    WSIO.emit(`${NAME}:command`, { command: 'browser:openPage', payload: url });
                });
            }
        },
        "reloadPage": {
            description: "Envia o sinal para recarregar as paginas abertas no navegador",
            _function: (data) => {
                WSIO.emit(`${NAME}:command`, { command: 'browser:reloadPage' });
            }
        },
        "setDelay": {
            description: "Envia o sinal para ajustar o delay das açoes nas paginas abertas do navegador",
            _function: (data) => {
                RL.question('Digite o novo tempo máximo de atraso em segundos: ', (delay) => {
                    const maxDelay = parseInt(delay) * 1000;
                    WSIO.emit(`${NAME}:command`, { command: 'setMaxDelay', data: maxDelay });
                });
            }
        },
    }
    /**
     * Função de inicialização da extensão.
     */
    const onInitialize = () => {
        console.log(`${NAME} initialized.`);
    };

    /**
     * Função de tratamento de erros da extensão.
     * 
     * @param {Error} error - O objeto de erro capturado
     */
    const onError = (error) => {
        console.error(`${NAME} error: ${error.message}`);
        // Lógica adicional de tratamento de erros
    };
    const CLIENT_LINK=`${NAME}/client`
    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        onInitialize,
        onError // Expor a função de erro para ser usada externamente
    };
};
