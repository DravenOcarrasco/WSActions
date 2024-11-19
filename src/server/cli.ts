import readline from 'readline';
import chalk from 'chalk';
import ModuleController from '../extenssionLoader';
import ABOUT from '../about';
import { Server as SocketIoServer } from 'socket.io';
import { Application } from 'express';

export class CLIManager {
    private rl: readline.Interface;
    private ExtensionsMenu: Record<number, Function> = {};

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.setupCommandHandler();
    }

    public init(io: SocketIoServer, app: Application) {
        ModuleController.init(io, app, this.rl);
        this.showMenu();
    }

    private wrapBox(text: string, borderColor: string = 'cyan'): string {
        const lines = text.split('\n').map(line => line.replace(/\s+$/, ''));  // Remove trailing spaces
        const contentWidth = Math.max(...lines.map(line => {
            // Calculate visual length considering ANSI escape codes
            const strippedLine = line.replace(/\u001b\[[0-9;]*m/g, '');
            return strippedLine.length;
        }));
        
        const horizontal = '─'.repeat(contentWidth + 4);
        const top = `┌${horizontal}┐`;
        const bottom = `└${horizontal}┘`;
        
        const wrapped = lines.map(line => {
            const strippedLine = line.replace(/\u001b\[[0-9;]*m/g, '');
            const padding = ' '.repeat(contentWidth - strippedLine.length);
            return `│  ${line}${padding}  │`;
        }).join('\n');
    
        return `${top}\n${wrapped}\n${bottom}`;
    }

    private setupCommandHandler() {
        this.rl.on('line', (input) => {
            const option = input.trim();
            const selectedOption = Number(option);
            const maxOption = Object.keys(this.ExtensionsMenu).length + 1;

            if (selectedOption === maxOption) {
                console.log(this.wrapBox(chalk.red('👋 Encerrando...')));
                this.rl.close();
                process.exit(0);
            } else if (!this.ExtensionsMenu[selectedOption]) {
                console.log(this.wrapBox(chalk.red('❌ Opção inválida. Tente novamente.')));
                console.clear();
                this.showMenu();
            } else {
                this.ExtensionsMenu[selectedOption]();
            }
        });
    }

    private renderLogo(): string {
        return chalk.cyan(`
   ██╗    ██╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
   ██║    ██║██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
   ██║ █╗ ██║███████╗    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
   ██║███╗██║╚════██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
   ╚███╔███╔╝███████║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
    ╚══╝╚══╝ ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
        `);
    }

    private renderExtensionStatus(): string {
        const enabledExtensions = ModuleController.EXTENSIONS.ENABLED.length > 0
            ? ModuleController.EXTENSIONS.ENABLED.map(ext => ext.NAME).join(', ')
            : 'Nenhuma';

        const disabledExtensions = ModuleController.EXTENSIONS.DISABLED.length > 0
            ? ModuleController.EXTENSIONS.DISABLED.map(ext => ext.NAME).join(', ')
            : 'Nenhuma';

        return this.wrapBox(
            `${chalk.bold('📊 Status das Extensões')}\n\n` +
            `${chalk.bold.green('✓')} Ativas:   ${chalk.green(enabledExtensions)}\n` +
            `${chalk.bold.red('✗')} Inativas: ${chalk.red(disabledExtensions)}`
        );
    }

    private renderCommands(): { menuText: string; menuOptions: Record<number, Function> } {
        const menuOptions: Record<number, Function> = {};
        let menuText = chalk.bold.yellow('\n🎯 Menu de Opções\n\n');
        let optionNumber = 1;

        for (const [extension, commands] of Object.entries(ModuleController.COMMANDS.CLI)) {
            menuText += chalk.bold.cyan(`\n📦 ${chalk.white(extension)}\n`);
            menuText += chalk.cyan('─'.repeat(40) + '\n');

            for (const [event, command] of Object.entries(commands)) {
                const paddedNumber = optionNumber.toString().padStart(2, '0');
                menuText += `${chalk.yellow(`${paddedNumber}.`)} ${chalk.green(event)}\n`;
                menuText += `    ${chalk.white((command as any).description)}\n`;
                menuOptions[optionNumber] = command._function;
                optionNumber++;
            }
        }

        const exitNumber = optionNumber.toString().padStart(2, '0');
        menuText += chalk.cyan('\n' + '─'.repeat(40) + '\n');
        menuText += `${chalk.yellow(`${exitNumber}.`)} ${chalk.red('Sair')}\n`;

        return { menuText, menuOptions };
    }

    private showMenu() {
        const headerText = `
            🚀 Versão: ${chalk.white(ABOUT.VERSION)}
            🔗 GitHub: ${chalk.underline.white(ABOUT.GIT)}
        `;
        
        console.log(this.renderLogo());
        console.log(this.wrapBox(headerText));
        console.log(this.renderExtensionStatus());

        const { menuText, menuOptions } = this.renderCommands();
        console.log(this.wrapBox(menuText));
        
        this.ExtensionsMenu = menuOptions;
        console.log(chalk.bold.green('\nDigite uma opção: '));
    }
}

export const cliManager = new CLIManager();