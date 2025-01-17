export default function mount(name: string) {
    return `
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
 * @param {Array<string>} [WEB_SCRIPTS=['client.js']] - Lista de scripts JavaScript a serem carregados dinamicamente.
 * @param {Array<string>} [GLOBAL_SCRIPTS=[]] - Lista de scripts JavaScript a serem carregados dinamicamente em um contexto global.
 * @param {string} EXTENSION_PATH - Caminho absoluto para a pasta da extensão
 * 
 * @returns {{ start: Function, stop: Function }} - Objeto da extensão com funções \`start\` e \`stop\`.
 */
module.exports = ({
    WSIO, 
    APP, 
    RL, 
    STORAGE, 
    EXPRESS, 
    WEB_SCRIPTS = ['client.js'],
    GLOBAL_SCRIPTS = [],
    EXTENSION_PATH = '', 
    ID = ''
}) => {
    const ENABLED = true;
    const NAME = "${name.toUpperCase()}";
    const CLIENT_LINK = \`\${NAME}/client\`;
    const ROUTER = EXPRESS.Router();

    // Definindo os eventos do WebSocket
    const IOEVENTS = {
        "sendMessage": {
            description: "Envio de uma mensagem de texto para o servidor WebSocket.",
            _function: (data) => {
                WSIO.to(ID).emit(\`message\`, data);
            }
        }
    };

    // Definindo os comandos do Readline
    const COMMANDS = {
        "exampleCommand": {
            description: "Comando de exemplo para enviar uma mensagem pelo WebSocket.",
            _function: () => {
                RL.question('Digite uma mensagem para enviar: ', (input) => {
                    WSIO.to(ID).emit(\`message\`, { message: input });
                });
            }
        }
    };

    const onInitialize = () => {
        // console.log(\`\${NAME} initialized.\`);
    };

    const onError = (error) => {
        // console.error(\`\${NAME} error: \${error.message}\`);
    };

    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        EXTENSION_PATH,
        WEB_SCRIPTS,
        GLOBAL_SCRIPTS,
        ID,
        onInitialize,
        onError
    };
};
    `;
}
