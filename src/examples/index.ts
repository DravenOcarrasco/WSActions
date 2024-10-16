export default function mount(name:string){
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
 * 
 * @returns {{ start: Function, stop: Function }} - Objeto da extensão com funções \`start\` e \`stop\`.
 */
module.exports = (WSIO, APP, RL, STORAGE, EXPRESS, WEB_SCRIPTS = ['client.js']) => {
    const ROUTER = EXPRESS.Router();
    const NAME = "${name.toUpperCase()}";
    const ENABLED = true;
    const IOEVENTS = {
        "example:event": {
            description: "Descrição do evento de exemplo",
            _function: (data) => {
                WSIO.emit(\`\${NAME}:event\`, data);
            }
        }
    };
    const COMMANDS = {
        "exampleCommand": {
            description: "Descrição do comando de exemplo",
            _function: (data) => {
                RL.question('Digite um valor de exemplo: ', (input) => {
                    WSIO.emit(\`\${NAME}:command\`, { command: 'example', payload: input });
                });
            }
        }
    };
    const onInitialize = () => {
        console.log(\`\${NAME} initialized.\`);
    };
    const onError = (error) => {
        console.error(\`\${NAME} error: \${error.message}\`);
    };
    const CLIENT_LINK = \`\${NAME}/client\`;
    var WEB_SCRIPTS = WEB_SCRIPTS;
    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        WEB_SCRIPTS,
        onInitialize,
        onError
    };
};
    `;
}