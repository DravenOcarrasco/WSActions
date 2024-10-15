import { existsSync, unlinkSync } from 'fs';
import express from 'express';
import { spawn } from 'child_process';
import { createSeparateWebSocketServer } from './modules/cli-websocket';
import { loadConfig } from './utils/config';
import cors from 'cors';
import os from 'os';
import { createOrLoadIdentityFile, updateIdentityFile } from './utils/identity';
import { prepareExtensions } from './utils/extensionManager';
import chalk from 'chalk';
import figlet from 'figlet';
import ABOUT from './about';
import path from 'path';
import extensions from '../extensions';

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const config = loadConfig();

// Função para exibir o cabeçalho em ASCII art
const showHeader = () => {
    console.log(
        chalk.blue(
            figlet.textSync(`WS ACTION`, {
                horizontalLayout: 'default',
                verticalLayout: 'default'
            })
        )
    );
};

// Função de autenticação baseada no arquivo de identidade
const authServer = async () => {
    const identity = createOrLoadIdentityFile();
    return {
        existUser: !!identity.user_id,
        user_id: identity.user_id,
    };
};

// Função para inicializar o servidor após a autenticação
const serverInit = async (IoPort: number) => {
    let { io } = await createSeparateWebSocketServer(IoPort);
    const { scheduleProfiles } = await import('./modules/schedule');
    scheduleProfiles();
};

// Função para abrir o Google Chrome com base no sistema operacional
const openChrome = (url: string) => {
    const platform = os.platform();
    let browserOpened = false;
    try {
        if (platform === 'darwin') {
            spawn('open', ['-a', 'Google Chrome', url], { detached: true, stdio: 'ignore' }).unref();
            browserOpened = true;
        } else if (platform === 'win32') {
            const chromePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ];

            let chromePath = chromePaths.find((chromePath) => existsSync(chromePath));

            if (chromePath) {
                spawn(chromePath, [url], { detached: true, stdio: 'ignore' }).unref();
                browserOpened = true;
            } else {
                console.log(chalk.red('Google Chrome não encontrado nos locais padrão.'));
            }
        } else if (platform === 'linux') {
            spawn('google-chrome', [url], { detached: true, stdio: 'ignore' }).unref();
        } else {
            console.log(chalk.red(`Sistema operacional não suportado: ${platform}`));
        }
    } catch (error) {
        console.log(chalk.red('Erro ao tentar abrir o Google Chrome'));
    }

    if (!browserOpened) {
        console.log(chalk.blue(`Por favor, abra manualmente o seguinte URL: ${url}`));
    }
};

// Função para reiniciar o processo usando atalhos
const restartProcess = (shortcutName: string) => {
    console.log(chalk.yellow(`Tentando reiniciar o processo usando o atalho ${shortcutName}...`));

    const isWindows = process.platform === 'win32';
    const isLinux = process.platform === 'linux';
    const currentDir = process.cwd();

    // Caminho do atalho
    const shortcutPath = isWindows
        ? path.join(currentDir, `${shortcutName}.lnk`)
        : isLinux
        ? path.join(currentDir, `${shortcutName}.desktop`)
        : '';

    // Verifica se o atalho existe
    if (!existsSync(shortcutPath)) {
        console.error(chalk.red(`O atalho ${shortcutName} não foi encontrado.`));
        return;
    }

    // Função para iniciar o processo filho e encerrar o pai
    const startProcess = (command: string, args: string[]) => {
        const subprocess = spawn(command, args, {
            cwd: process.cwd(),
            detached: true,
            stdio: 'inherit',
            shell: true
        });

        subprocess.on('spawn', () => {
            console.log(chalk.green('Novo processo iniciado com sucesso. Encerrando o processo pai.'));
            process.exit(0); // Encerrar o processo pai após iniciar o filho
        });

        subprocess.on('error', (err) => {
            console.error(chalk.red('Erro ao reiniciar o processo:'), err);
            setTimeout(() => startProcess(command, args), 2000); // Tentar novamente após 2 segundos
        });
    };

    if (isWindows) {
        console.log(chalk.blue(`Reiniciando processo no Windows usando o atalho ${shortcutName}.lnk...`));
        // Executa o atalho diretamente
        startProcess('explorer', [shortcutPath]);
    } else if (isLinux) {
        console.log(chalk.blue(`Reiniciando processo no Linux usando o atalho ${shortcutName}.desktop...`));
        // Executa o atalho diretamente no Linux
        startProcess('xdg-open', [shortcutPath]);
    } else {
        console.error(chalk.red('Sistema operacional não suportado.'));
    }
};

// API para registrar o user_id
app.post('/register', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ error: 'user_id é obrigatório' });
    }
    updateIdentityFile(user_id);
    res.json({ message: 'user_id registrado com sucesso' });
    console.log(chalk.green(`WSACTION PREPARADO!`));

    setTimeout(() => {
        restartProcess('Run-Server');  // Reiniciar o processo em vez de fechar
    }, 3000);
});

// Função principal que chama a autenticação e inicializa o servidor se a autenticação for válida
export default async (IoPort: number) => {
    showHeader();

    const { existUser, user_id } = await authServer();

    if (existUser) {
        console.log(chalk.green('Usuário autenticado com sucesso!'));

        // Definir a função reloadModules
        const reloadModules = () => {
            // restartProcess();
        };

        // Passar user_id e reloadModules para prepareExtensions
        await prepareExtensions(user_id as string, reloadModules);

        // O processo será reiniciado após a atualização das extensões
        // Portanto, o código abaixo pode não ser executado no processo atual
        const { default: api } = await import('./api');
        await serverInit(IoPort);

    } else {
        console.log(chalk.red('Nenhum usuário registrado. Por favor, registre-se.'));

        app.listen(9513, async () => {
            console.log(chalk.yellow('Servidor API escutando na porta 9513.'));
            openChrome(`${config.dashboard_endpoint}`);
        });
    }
};
