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

    private setupCommandHandler() {
        this.rl.on('line', (input) => {
            const option = input.trim();
            const selectedOption = Number(option);

            if (selectedOption === Object.keys(this.ExtensionsMenu).length + 1) {
                console.log(chalk.red('\n👋 Encerrando...\n'));
                this.rl.close();
                process.exit(0);
            } else if (!this.ExtensionsMenu[selectedOption]) {
                console.log(chalk.red('\n❌ Opção inválida. Tente novamente.\n'));
                this.showMenu();
            } else {
                this.ExtensionsMenu[selectedOption]();
            }
        });
    }

    private showMenu() {
        console.clear(); // Limpa o terminal para melhor visualização

        // Header
        const headerBorder = '━'.repeat(60);
        console.log(chalk.cyan(headerBorder));
        console.log(chalk.bold.magentaBright(`
   ██╗    ██╗███████╗     █████╗  ██████╗████████╗██╗ ██████╗ ███╗   ██╗
   ██║    ██║██╔════╝    ██╔══██╗██╔════╝╚══██╔══╝██║██╔═══██╗████╗  ██║
   ██║ █╗ ██║███████╗    ███████║██║        ██║   ██║██║   ██║██╔██╗ ██║
   ██║███╗██║╚════██║    ██╔══██║██║        ██║   ██║██║   ██║██║╚██╗██║
   ╚███╔███╔╝███████║    ██║  ██║╚██████╗   ██║   ██║╚██████╔╝██║ ╚████║
    ╚══╝╚══╝ ╚══════╝    ╚═╝  ╚═╝ ╚═════╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`));
        console.log(chalk.cyan(headerBorder));

        // Versão e GitHub
        console.log(chalk.bold.blueBright(`\n  🚀 Versão: ${chalk.white(ABOUT.VERSION)}`));
        console.log(chalk.bold.blueBright(`  🔗 GitHub: ${chalk.underline.white(ABOUT.GIT)}\n`));
        console.log(chalk.cyan(headerBorder));

        // Status das Extensões
        const enabledExtensions = ModuleController.EXTENSIONS.ENABLED.length > 0
            ? ModuleController.EXTENSIONS.ENABLED.map(ext => ext.NAME).join(', ')
            : 'Nenhuma';

        const disabledExtensions = ModuleController.EXTENSIONS.DISABLED.length > 0
            ? ModuleController.EXTENSIONS.DISABLED.map(ext => ext.NAME).join(', ')
            : 'Nenhuma';

        console.log(chalk.bold('\n  📊 Status das Extensões\n'));
        console.log(`  ${chalk.bold.green('✓')} Ativas:    ${chalk.green(enabledExtensions)}`);
        console.log(`  ${chalk.bold.red('✗')} Inativas:  ${chalk.red(disabledExtensions)}\n`);
        console.log(chalk.cyan(headerBorder));

        // Menu de Opções
        console.log(chalk.bold.yellow('\n  🎯 Menu de Opções\n'));
        
        this.ExtensionsMenu = {};
        let optionNumber = 1;

        // Adicionar comandos das extensões ao menu
        for (const [extension, commands] of Object.entries(ModuleController.COMMANDS.CLI)) {
            console.log(chalk.bold.cyan(`\n  📦 Extensão: ${chalk.white(extension)}`));
            console.log(chalk.cyan('  ' + '─'.repeat(40)));
            
            for (const [event, command] of Object.entries(commands)) {
                const paddedNumber = optionNumber.toString().padStart(2, '0');
                console.log(`  ${chalk.yellow(`${paddedNumber}.`)} ${chalk.green(event)}`);
                console.log(`     ${chalk.white((command as any).description)}`);
                this.ExtensionsMenu[optionNumber] = command._function;
                optionNumber++;
            }
        }

        // Opção para sair
        const exitNumber = optionNumber.toString().padStart(2, '0');
        console.log(chalk.cyan('\n  ' + '─'.repeat(40)));
        console.log(`  ${chalk.yellow(`${exitNumber}.`)} ${chalk.red('Sair')}\n`);
        console.log(chalk.cyan(headerBorder));
        
        // Prompt
        console.log(chalk.bold.green('\n  Digite uma opção: '));
    }
}

export const cliManager = new CLIManager();