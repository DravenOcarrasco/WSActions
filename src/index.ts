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
import prompts from 'prompts';

const IoPort = 9532;
// Função para criar um atalho usando PowerShell
function createShortcut(executablePath: string, shortcutName: string, args: string) {
    const shortcutPath = path.join(process.cwd(), `${shortcutName}.lnk`);
    if (fs.existsSync(shortcutPath)) {
        // console.log(`Shortcut ${shortcutName} already exists.`);
        return Promise.resolve(`Shortcut ${shortcutName} already exists.`);
    }
    const powershellScript = `
        $WScriptShell = New-Object -ComObject WScript.Shell;
        $Shortcut = $WScriptShell.CreateShortcut('${shortcutPath}');
        $Shortcut.TargetPath = '${executablePath}';
        $Shortcut.Arguments = '${args}';
        $Shortcut.Save();
    `;
    const encodedCommand = Buffer.from(powershellScript, 'utf16le').toString('base64');
    return new Promise((resolve, reject) => {
        exec(`powershell -EncodedCommand ${encodedCommand}`, (error, stdout, stderr) => {
            if (error) {
                reject(`Error creating shortcut: ${error}`);
            } else {
                resolve(`Shortcut ${shortcutName} created successfully.`);
            }
        });
    });
}
createShortcut(path.resolve(process.execPath), 'Run-Server', 'server')
createShortcut(path.resolve(process.execPath), 'open-chrome', 'open-chrome')

// Função para criar uma extensão
async function createExtension(name: string) {
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
async function deleteExtension(name: string) {
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let extensionName = argv.name;
            if (!extensionName) {
                const response = await prompts({
                    type: 'text',
                    name: 'extensionName',
                    message: 'Digite o nome da extensão:'
                });
                extensionName = response.extensionName;
            }

            if (extensionName) {
                await createExtension(extensionName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let extensionName = argv.name;
            if (!extensionName) {
                const response = await prompts({
                    type: 'text',
                    name: 'extensionName',
                    message: 'Digite o nome da extensão:'
                });
                extensionName = response.extensionName;
            }

            if (extensionName) {
                await deleteExtension(extensionName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let profileName = argv.name;
            if (!profileName) {
                const response = await prompts({
                    type: 'text',
                    name: 'profileName',
                    message: 'Digite o nome do perfil:'
                });
                profileName = response.profileName;
            }

            if (profileName) {
                ChromeManager.createProfile(profileName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let profileName = argv.name;
            if (!profileName) {
                const response = await prompts({
                    type: 'text',
                    name: 'profileName',
                    message: 'Digite o nome do perfil:'
                });
                profileName = response.profileName;
            }

            if (profileName) {
                ChromeManager.removeProfile(profileName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let groupName = argv.name;
            if (!groupName) {
                const response = await prompts({
                    type: 'text',
                    name: 'groupName',
                    message: 'Digite o nome do grupo:'
                });
                groupName = response.groupName;
            }

            if (groupName) {
                ChromeManager.addGroup(groupName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let groupName = argv.name;
            if (!groupName) {
                const response = await prompts({
                    type: 'text',
                    name: 'groupName',
                    message: 'Digite o nome do grupo:'
                });
                groupName = response.groupName;
            }

            if (groupName) {
                ChromeManager.removeGroup(groupName);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: 'open-chrome',
        describe: 'Abre uma perfil do Chrome',
        builder: {
            profile: {
                describe: 'Nome do perfil',
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let profileName = argv.profile;
            if (!profileName) {
                const response = await prompts({
                    type: 'text',
                    name: 'profileName',
                    message: 'Digite o nome do perfil:'
                });
                profileName = response.profileName;
            }

            if (profileName) {
                try {
                    await sendToServer(IoPort, "open-chrome", { profile: profileName });
                } catch (error) {
                    console.error("Server not initialized");
                }
            }
            process.exit(0);
        },
    })
    .command({
        command: 'open-group',
        describe: 'Abre um grupo de perfis do Chrome',
        builder: {
            name: {
                describe: 'Nome do grupo',
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let groupName = argv.name;
            if (!groupName) {
                const response = await prompts({
                    type: 'text',
                    name: 'groupName',
                    message: 'Digite o nome do grupo:'
                });
                groupName = response.groupName;
            }

            if (groupName) {
                const profilesData = ChromeManager.getProfilesData();
                var extensions = [...new Set([...profilesData.defaultExtensions, ...ChromeManager.getGroupInfo(groupName)?.extensions ?? []])];
                const group = profilesData.groups.find(g => g.name === groupName);
                if (group) {
                    for (const profileName of group.profiles) {
                        const prof = ChromeManager.getProfileInfo(profileName)
                        if (prof) {
                            await ChromeManager.launchChrome(profileName, extensions, prof);
                        }
                    }
                } else {
                    console.error(`Group not found: ${groupName}`);
                }
            }
            process.exit(0);
        },
    })
    .command({
        command: 'add-default-extension',
        describe: 'Adiciona uma extensão padrão',
        builder: {
            name: {
                describe: 'Nome da extensão',
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let extensionName = argv.name;
            if (!extensionName) {
                const response = await prompts({
                    type: 'text',
                    name: 'extensionName',
                    message: 'Digite o nome da extensão:'
                });
                extensionName = response.extensionName;
            }

            if (extensionName) {
                ChromeManager.addDefaultExtension(extensionName);
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
                demandOption: false,
                type: 'string',
            },
        },
        async handler(argv) {
            let extensionName = argv.name;
            if (!extensionName) {
                const response = await prompts({
                    type: 'text',
                    name: 'extensionName',
                    message: 'Digite o nome da extensão:'
                });
                extensionName = response.extensionName;
            }

            if (extensionName) {
                ChromeManager.removeDefaultExtension(extensionName);
            }
            process.exit(0); // Sair após a execução do comando
        },
    })
    .command({
        command: "server",
        describe: "inicializa em modo servidor",
        async handler(argv) {
            let io = await startWebSocketServer();
            io?.listen(IoPort);
            const { default: api } = await import('./api');
            const { scheduleProfiles } = await import('./modules/schedule');
            scheduleProfiles();
            const API = api;
        }
    })
    .parse();
