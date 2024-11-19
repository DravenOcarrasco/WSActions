import { Server as SocketIoServer } from 'socket.io';
import { Application } from 'express';
import readline from 'readline';
import { Extension, Commands } from './types';
import { ExtensionWatcher } from './watcher';
import { ExtensionReloader } from './reloader';
import chalk from 'chalk';

export class HotReloadManager {
    private watcher: ExtensionWatcher;
    private reloader: ExtensionReloader;

    constructor(
        private WSIO: SocketIoServer | null,
        private APP: Application | null,
        private RL: readline.Interface | null,
        private STORAGE: Record<string, any>,
        private saveStorage: () => void,
        private EXTENSIONS: { ENABLED: Extension[], DISABLED: Extension[] },
        private COMMANDS: Commands
    ) {
        this.watcher = new ExtensionWatcher();
        this.reloader = new ExtensionReloader(
            WSIO,
            APP,
            RL,
            STORAGE,
            saveStorage,
            EXTENSIONS,
            COMMANDS
        );
    }

    public watchExtension(extension: Extension): void {
        if (!extension.EXTENSION_PATH) {
            //console.warn(chalk.yellow(`⚠️ Cannot watch extension ${extension.NAME}: No extension path provided`));
            return;
        }

        this.watcher.watchDirectory(
            extension.EXTENSION_PATH,
            extension.NAME,
            () => this.reloader.reloadExtension(extension)
        );
    }

    public stopWatchingExtension(extensionName: string): void {
        this.watcher.stopWatching(extensionName);
    }

    public watchAllExtensions(): void {
        this.EXTENSIONS.ENABLED.forEach(extension => {
            this.watchExtension(extension);
        });
    }

    public stopWatchingAll(): void {
        this.watcher.stopWatchingAll();
    }

    public async reloadExtension(extension: Extension): Promise<void> {
        await this.reloader.reloadExtension(extension);
    }

    public async reloadAllExtensions(): Promise<void> {
        for (const extension of this.EXTENSIONS.ENABLED) {
            await this.reloadExtension(extension);
        }
    }
}
