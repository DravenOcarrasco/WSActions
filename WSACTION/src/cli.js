const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

function createExtension(name) {
    const extensionDir = path.join(process.cwd(), 'extensions', name);
    
    if (fs.existsSync(extensionDir)) {
        console.log(`A extensão ${name} já existe.`);
        return;
    }
    
    fs.mkdirSync(extensionDir, { recursive: true });
    
    const indexFileContent = `
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
    `;

    const clientFileContent = `
(async function () {
    const MODULE_NAME = "${name.toUpperCase()}";
    const socket = io('http://127.0.0.1:9514/', { secure: true });

    const setStorage = async (key, value) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
            }, 10000);
    
            socket.on(\`storage.store.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`, (data) => {
                clearTimeout(timeout);
                resolve(data);
            });
    
            socket.emit('storage.store', {
                extension: MODULE_NAME,
                id: window.identifier,
                key,
                value,
                response: \`storage.store.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`
            });
        });
    };
    
    const getStorage = async (key) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
            }, 10000);
    
            socket.on(\`storage.load.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`, (data) => {
                clearTimeout(timeout);
                if (data.success) {
                    resolve(data);
                } else {
                    resolve({ success: false, error: 'Erro ao carregar o armazenamento' });
                }
            });
    
            socket.emit('storage.load', {
                extension: MODULE_NAME,
                id: window.identifier,
                key,
                response: \`storage.load.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`
            });
        });
    };
    
    const getVariable = async (variableName, defaultValue, create = false) => {
        const data = await getStorage(variableName);
        if (!data.success && create) {
            await setStorage(variableName, defaultValue);
            return defaultValue;
        } else if (data.success) {
            return data.value;
        } else {
            return defaultValue;
        }
    };

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');

        socket.on(\`\${MODULE_NAME}:event\`, (data) => {
            console.log('Received event:', data);
        });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
})();
    `;

    fs.writeFileSync(path.join(extensionDir, 'index.js'), indexFileContent.trim());
    fs.writeFileSync(path.join(extensionDir, 'client.js'), clientFileContent.trim());

    console.log(`Extensão ${name} criada com sucesso em ${extensionDir}.`);
}

yargs.command({
    command: 'create-extension',
    describe: 'Cria uma nova extensão',
    builder: {
        name: {
            describe: 'Nome da extensão',
            demandOption: true,
            type: 'string'
        }
    },
    handler(argv) {
        createExtension(argv.name);
        process.exit(0); // Sair após a execução do comando
    }
});

yargs.parse();
