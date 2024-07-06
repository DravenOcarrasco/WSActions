import ChromeManager from './chromeManager';
import { loadConfig } from './config';
const config = loadConfig();
ChromeManager.initializeChromeManager(config.chromeProfilePath);
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { startWebSocketServer, sendToServer, io } from './cli-websocket';

import yargs, { command } from 'yargs';
import { hideBin } from 'yargs/helpers';

import indexExample from './examples/index';
import clientExample from './examples/client';

const IoPort = 9532;
let WEBSOCKET_FOUND = false;

// Função para criar uma extensão
function createExtension(name: string) {
    const extensionDir = path.join(process.cwd(), 'extensions', name);

    if (fs.existsSync(extensionDir)) {
        console.log(`A extensão ${name} já existe.`);
        return;
    }

    fs.mkdirSync(extensionDir, { recursive: true });

    const indexFileContent = indexExample(name);
    const clientFileContent = clientExample(name);

    fs.writeFileSync(path.join(extensionDir, 'index.js'), indexFileContent.trim());
    fs.writeFileSync(path.join(extensionDir, 'client.js'), clientFileContent.trim());

    console.log(`Extensão ${name} criada com sucesso em ${extensionDir}.`);
}

// Função para deletar uma extensão
function deleteExtension(name: string) {
    const extensionDir = path.join(process.cwd(), 'extensions', name);

    if (!fs.existsSync(extensionDir)) {
        console.log(`A extensão ${name} não existe.`);
        return;
    }

    fs.rmdirSync(extensionDir, { recursive: true });
    console.log(`Extensão ${name} deletada com sucesso.`);
}

yargs(hideBin(process.argv))
    .command({
        command: 'create-extension',
        describe: 'Cria uma nova extensão',
        builder: {
            name: {
                describe: 'Nome da extensão',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                createExtension(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'delete-extension',
        describe: 'Deleta uma extensão existente',
        builder: {
            name: {
                describe: 'Nome da extensão',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                deleteExtension(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'create-profile',
        describe: 'Cria um novo perfil',
        builder: {
            name: {
                describe: 'Nome do perfil',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.createProfile(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'remove-profile',
        describe: 'Remove um perfil existente',
        builder: {
            name: {
                describe: 'Nome do perfil',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.removeProfile(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'create-group',
        describe: 'Cria um novo grupo',
        builder: {
            name: {
                describe: 'Nome do grupo',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.addGroup(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'remove-group',
        describe: 'Remove um grupo existente',
        builder: {
            name: {
                describe: 'Nome do grupo',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.removeGroup(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'open-chrome',
        describe: 'Abre uma instância do Chrome',
        builder: {
            name: {
                describe: 'Nome da instância',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            (async () => {
                if (typeof argv.name === 'string') {
                    try {
                        await sendToServer(IoPort, "open-chrome", { profile: argv.name });
                        process.exit(0);
                    } catch (error) {
                        await ChromeManager.launchProfilesByName(argv.name);
                    }
                }
            })()
        },
    })
    .command({
        command: 'open-group',
        describe: 'Abre um grupo de perfis do Chrome',
        builder: {
            name: {
                describe: 'Nome do grupo',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            (async () => {
                if (typeof argv.name === 'string') {
                    const profilesData = ChromeManager.getProfilesData();
                    var extensions = [...new Set([...profilesData.defaultExtensions, ...ChromeManager.getGroupInfo(argv.name)?.extensions ?? []])];
                    const group = profilesData.groups.find(g => g.name === argv.name);
                    if (group) {
                        for (const profileName of group.profiles) {
                            await ChromeManager.launchChrome(profileName, extensions);
                        }
                    } else {
                        console.error(`Group not found: ${argv.name}`);
                    }
                }
                process.exit(0);
            })()
        },
    })
    .command({
        command: 'add-default-extension',
        describe: 'Adiciona uma extensão padrão',
        builder: {
            name: {
                describe: 'Nome da extensão',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.addDefaultExtension(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'remove-default-extension',
        describe: 'Remove uma extensão padrão',
        builder: {
            name: {
                describe: 'Nome da extensão',
                demandOption: true,
                type: 'string',
            },
        },
        handler(argv) {
            if (typeof argv.name === 'string') {
                ChromeManager.removeDefaultExtension(argv.name);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: "server",
        describe: "inicializa em modo servidor",
        async handler(argv) {
            const { default: api } = await import('./api');
            const { scheduleProfiles } = await import('./modules/schedule');
            scheduleProfiles();
            const API = api;
            try {
                let io = await startWebSocketServer();
                if (io) {
                    io.on('connection', (socket) => {
                        socket.on('open-chrome', (data) => {
                            ChromeManager.launchProfilesByName(data.profile);
                        });
                    });
                    io.listen(IoPort);
                }
            } catch (error) {
                console.error('Failed to start WebSocket server:', error);
            }
        }
    })
    .parse();