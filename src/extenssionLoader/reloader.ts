import { Server as SocketIoServer } from 'socket.io';
import { Application } from 'express';
import readline from 'readline';
import path from 'path';
import chalk from 'chalk';
import { Extension, Commands } from './types';

export class ExtensionReloader {
    constructor(
        private WSIO: SocketIoServer | null,
        private APP: Application | null,
        private RL: readline.Interface | null,
        private STORAGE: Record<string, any>,
        private saveStorage: () => void,
        private EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] },
        private COMMANDS: Commands
    ) {}

    public async reloadExtension(oldExtension: Extension): Promise<void> {
        try {
            // Remove old extension from enabled list
            const index = this.EXTENSIONS.ENABLED.findIndex(e => e.NAME === oldExtension.NAME);
            if (index === -1) return;

            this.EXTENSIONS.ENABLED.splice(index, 1);

            // Clean up old commands
            this.cleanupCommands(oldExtension);

            // Clean up old IO events
            this.cleanupIOEvents(oldExtension);

            // Load new extension
            if (!oldExtension.EXTENSION_PATH) {
                throw new Error('Extension path not found');
            }

            await this.loadNewExtension(oldExtension.EXTENSION_PATH, oldExtension.NAME);

        } catch (error) {
            console.error(chalk.red(`❌ Error reloading extension ${oldExtension.NAME}:`), error);
            // Re-add the old extension if reload fails
            this.EXTENSIONS.ENABLED.push(oldExtension);
        }
    }

    private cleanupCommands(extension: Extension): void {
        if (extension.COMMANDS) {
            Object.keys(extension.COMMANDS).forEach(event => {
                this.WSIO?.removeAllListeners(`${extension.NAME}.${event}`);
                if (this.COMMANDS.CLI[extension.NAME]) {
                    delete this.COMMANDS.CLI[extension.NAME][event];
                }
            });
        }
    }

    private cleanupIOEvents(extension: Extension): void {
        if (extension.IOEVENTS && this.COMMANDS.IO[extension.NAME]) {
            delete this.COMMANDS.IO[extension.NAME];
        }
    }

    private async loadNewExtension(extensionPath: string, extensionName: string): Promise<void> {
        // Clear require cache for the extension
        Object.keys(require.cache).forEach(key => {
            if (key.startsWith(extensionPath)) {
                delete require.cache[key];
            }
        });

        // Re-require and initialize the extension
        const extensionModule = require(extensionPath);
        const metaPath = path.join(extensionPath, "meta.json");
        const metadata = JSON.parse(require('fs').readFileSync(metaPath, 'utf8'));

        const newExtension = extensionModule({
            WSIO: this.WSIO,
            APP: this.APP,
            RL: this.RL,
            STORAGE: { data: this.STORAGE, save: this.saveStorage },
            EXPRESS: require('express'),
            WEB_SCRIPTS: metadata?.WEB_SCRIPTS || ['client.js'],
            EXTENSION_PATH: extensionPath,
            ID: metadata.id
        });

        if (newExtension.ENABLED) {
            await this.initializeNewExtension(newExtension);
            console.log(chalk.green(`✅ Extension ${newExtension.NAME} reloaded successfully`));
        }
    }

    private async initializeNewExtension(extension: Extension): Promise<void> {
        extension.onInitialize();
        this.EXTENSIONS.ENABLED.push(extension);
        this.STORAGE[extension.NAME] ||= {};

        // Configure new commands
        if (extension.COMMANDS) {
            Object.entries(extension.COMMANDS).forEach(([event, handler]) => {
                this.WSIO?.on(`${extension.NAME}.${event}`, handler._function);
                this.COMMANDS.CLI[extension.NAME] ||= {};
                this.COMMANDS.CLI[extension.NAME][event] = handler;
            });
        }

        // Configure new IO events
        if (extension.IOEVENTS) {
            Object.entries(extension.IOEVENTS).forEach(([event, handler]) => {
                this.COMMANDS.IO[extension.NAME] ||= {};
                this.COMMANDS.IO[extension.NAME][event] = handler;
            });
        }
    }
}
