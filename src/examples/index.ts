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
 * @param {string} EXTENSION_PATH - Caminho absoluto para a pasta da extensão
 * 
 * @returns {{ start: Function, stop: Function }} - Objeto da extensão com funções \`start\` e \`stop\`.
 */
module.exports = (WSIO, APP, RL, STORAGE, EXPRESS, WEB_SCRIPTS = ['client.js'], EXTENSION_PATH = '') => {
    const ENABLED = true;
    const NAME = "${name.toUpperCase()}";
    const CLIENT_LINK = \`\${NAME}/client\`;
    var WEB_SCRIPTS = WEB_SCRIPTS;
    var EXTENSION_PATH = EXTENSION_PATH;
    const ROUTER = EXPRESS.Router();

    // Definindo os eventos do WebSocket
    const IOEVENTS = {
        "sendMessage": {
            description: "Envio de uma mensagem de texto para o servidor WebSocket.",
            _function: (data) => {
                WSIO.emit(\`\${NAME}:sendMessage\`, { message: data });
            }
        },
        "updateSettings": {
            description: "Atualização de configurações do usuário.",
            _function: (data) => {
                WSIO.emit(\`\${NAME}:updateSettings\`, { theme: data.theme, notifications: data.notifications });
            }
        },
        "requestData": {
            description: "Solicita dados ao servidor usando WebSocket.",
            _function: (data) => {
                WSIO.emit(\`\${NAME}:requestData\`, { userId: data.userId });
            }
        },
        "taskCompleted": {
            description: "Notifica o servidor que uma tarefa foi completada.",
            _function: (data) => {
                WSIO.emit(\`\${NAME}:taskCompleted\`, { taskId: data.taskId, status: data.status });
            }
        }
    };

    // Definindo os comandos do Readline
    const COMMANDS = {
        "exampleCommand": {
            description: "Comando de exemplo para enviar uma mensagem pelo WebSocket.",
            _function: () => {
                RL.question('Digite uma mensagem para enviar: ', (input) => {
                    WSIO.emit(\`\${NAME}:sendMessage\`, { message: input });
                });
            }
        },
        "updateSettingsCommand": {
            description: "Atualiza as configurações do tema e notificações.",
            _function: () => {
                RL.question('Digite o tema (light/dark): ', (theme) => {
                    RL.question('Deseja ativar notificações? (yes/no): ', (notifications) => {
                        const enableNotifications = notifications.toLowerCase() === 'yes';
                        WSIO.emit(\`\${NAME}:updateSettings\`, { theme, notifications: enableNotifications });
                    });
                });
            }
        },
        "requestDataCommand": {
            description: "Comando para solicitar dados de um usuário específico.",
            _function: () => {
                RL.question('Digite o ID do usuário para solicitar os dados: ', (userId) => {
                    WSIO.emit(\`\${NAME}:requestData\`, { userId: parseInt(userId) });
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

    return {
        NAME,
        ROUTER,
        ENABLED,
        IOEVENTS,
        COMMANDS,
        CLIENT_LINK,
        EXTENSION_PATH,
        WEB_SCRIPTS,
        onInitialize,
        onError
    };
};
    `;
}
