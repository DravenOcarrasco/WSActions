import { Server as SocketIoServer } from 'socket.io';
import { Application } from 'express';
import readline from 'readline';
import { Extension, Commands, LoadAllExtensionsConfig } from './types';
import { ExtensionWatcher } from './watcher';
import { ExtensionReloader } from './reloader';
import chalk from 'chalk';

export class HotReloadManager {
    private watcher: ExtensionWatcher;
    private reloader: ExtensionReloader;

    constructor(
        private config: LoadAllExtensionsConfig,
    ) {
        this.watcher = new ExtensionWatcher();
        this.reloader = new ExtensionReloader(
            config
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
        this.config.EXTENSIONS.ENABLED.forEach(extension => {
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
        for (const extension of this.config.EXTENSIONS.ENABLED) {
            await this.reloadExtension(extension);
        }
    }
}
