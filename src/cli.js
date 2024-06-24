const fs = require('fs');
const path = require('path');

function createExtension(name) {
    const extensionDir = path.join(process.execDir, 'extensions', name);
    
    if (fs.existsSync(extensionDir)) {
        console.log(`A extensão ${name} já existe.`);
        return;
    }
    
    fs.mkdirSync(extensionDir);
    
    const indexFileContent = `
module.exports = (WSIO, APP, RL, EXPRESS) => {
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
(function () {
    const MODULE_NAME = "${name.toUpperCase()}";
    const socket = io('https://127.0.0.1:9515/', { secure: true });

    function exampleFunction() {
        console.log('Example function executed.');
    }

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');

        socket.on(\`\${MODULE_NAME}:event\`, (data) => {
            console.log('Received event:', data);
            exampleFunction();
        });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
})();
    `;

    fs.writeFileSync(path.join(extensionDir, 'index.js'), indexFileContent);
    fs.writeFileSync(path.join(extensionDir, 'client.js'), clientFileContent);

    console.log(`Extensão ${name} criada com sucesso em ${extensionDir}.`);
}

// Configuração do yargs
const yargs = require('yargs');

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
