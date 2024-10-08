import express, { Application } from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIoServer } from 'socket.io';
import readline from 'readline';
import cors from 'cors';
import ModuleController from '../extensions';  // Verifique se o caminho para este módulo está correto
import { loadConfig } from './utils/config';
import { cwd } from 'process';
import { readFile } from 'fs/promises';
import chalk from 'chalk';  // Usando chalk para colorir o menu
import ABOUT from './about';

const config = loadConfig();

// Definir o diretório de execução
const execPath = process.execPath;
const execDir = execPath.includes("bun.exe") || execPath.includes("node.exe")
    ? path.dirname(__dirname)
    : path.dirname(execPath);
console.log(chalk.blue(`EXT_PATH: ${path.resolve(execDir, 'extensions')}`));

// Inicializando o Express
const app: Application = express();
app.use(cors());

// Servir arquivos estáticos
app.use(express.static(path.join(execDir, "public")));

// Middleware personalizado para /client.js
app.get('/client.js', async (req, res) => {
    const filePath = path.join(cwd(), 'scripts', 'injector.js');
    const additionalScripts = `
        if(window.injectorPort == undefined) window.injectorPort = '${config.http.port}';
    `;

    try {
        const data = await readFile(filePath, 'utf8');
        const modifiedContent = additionalScripts + data;
        
        res.setHeader('Content-Type', 'application/javascript');
        res.send(modifiedContent);
    } catch (err) {
        console.log(err)
        res.status(500).send('Internal Server Error');
    }
});

// Inicializando servidores HTTP para WebSocket
const httpServerWS = http.createServer(app);

// Inicializando o Socket.IO para ambos os servidores
const io = new SocketIoServer(httpServerWS, {
    cors: {
        origin: '*' // Permitindo acesso de qualquer origem (CORS)
    }
});

io.on('connection', (socket) => {
    ModuleController.initIoToSocket(socket);
});

// Iniciando os servidores WebSocket
httpServerWS.listen(config.http.port, () => {
    console.log(chalk.green(`HTTP Server running at http://127.0.0.1:${config.http.port}`));
});

// Interface de linha de comando (CLI) para enviar comandos
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

ModuleController.init(io, app, rl);

let ExtensionsMenu: any = {};

// Função para exibir o menu
function showMenu() {
    console.clear();  // Limpa o terminal para melhor visualização do menu

    // Mostrar extensões habilitadas e desabilitadas logo após limpar o terminal
    const enabledExtensions = ModuleController.EXTENSIONS.ENABLED.length > 0
        ? ModuleController.EXTENSIONS.ENABLED.map(ext => ext.NAME).join(', ')
        : '';

    const disabledExtensions = ModuleController.EXTENSIONS.DISABLED.length > 0
        ? ModuleController.EXTENSIONS.DISABLED.map(ext => ext.NAME).join(', ')
        : '';

    console.log(chalk.bold.greenBright('Extensões Habilitadas:'), chalk.green(`[${enabledExtensions}]`));
    console.log(chalk.bold.redBright('Extensões Desabilitadas:'), chalk.red(`[${disabledExtensions}]`));

    const border = chalk.bold.yellowBright('===================================');
    let menuText = `
${border}
${chalk.bold.magentaBright('  🕹️  WSACTION')}${chalk.cyanBright(ABOUT.VERSION)}
${chalk.greenBright('  🔗 GITHUB: ')} ${chalk.underline.blue(ABOUT.GIT)}
${border}
`;
    menuText += chalk.bold('Escolha uma das opções:\n');

    ExtensionsMenu = {};
    let optionNumber = 1;

    // Adicionar comandos das extensões ao menu
    for (const [extension, commands] of Object.entries(ModuleController.COMMANDS.CLI)) {
        menuText += chalk.bold.green(`\nExtensão: ${chalk.blueBright(extension)}\n`);
        for (const [event, command] of Object.entries(commands)) {
            menuText += `${chalk.yellow(optionNumber + '.')} ${chalk.green(event)}: ${chalk.white((command as any).description)}\n`;
            ExtensionsMenu[optionNumber] = command._function;
            optionNumber++;
        }
        menuText += chalk.bold.yellowBright('-----------------------------------');
    }

    // Opção para sair
    menuText += `\n${chalk.yellow(`${optionNumber}`)}. ${chalk.red('Sair')}\n`;

    // Mostrar o menu
    console.log(menuText);
}

// Função para lidar com a escolha do menu
rl.on('line', (input) => {
    const option = input.trim();
    const selectedOption = Number(option);

    if (selectedOption === Object.keys(ExtensionsMenu).length + 1) {
        console.log(chalk.red('Encerrando...'));
        rl.close();
        process.exit(0);
    } else if (!ExtensionsMenu[selectedOption]) {
        console.log(chalk.red('Opção inválida. Tente novamente.'));
        showMenu();
    } else {
        ExtensionsMenu[selectedOption]();
    }
});

showMenu();

export default httpServerWS;
