import { watch } from 'fs';
import chalk from 'chalk';

export class ExtensionWatcher {
    private watchers: Map<string, any> = new Map();
    private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

    public watchDirectory(extensionPath: string, extensionName: string, onChange: () => void): void {
        // Stop existing watcher if any
        this.stopWatching(extensionName);

        const watcher = watch(extensionPath, { recursive: true }, (eventType, filename) => {
            // Debounce the reload to prevent multiple reloads for the same change
            if (this.debounceTimers.has(extensionName)) {
                clearTimeout(this.debounceTimers.get(extensionName));
            }

            this.debounceTimers.set(extensionName, setTimeout(() => {
                console.log(chalk.blue(`🔄 Change detected in extension ${extensionName}, reloading...`));
                onChange();
            }, 300));
        });

        this.watchers.set(extensionName, watcher);
        console.log(chalk.green(`👀 Watching extension ${extensionName} for changes`));
    }

    public stopWatching(extensionName: string): void {
        if (this.watchers.has(extensionName)) {
            this.watchers.get(extensionName).close();
            this.watchers.delete(extensionName);
            console.log(chalk.yellow(`🛑 Stopped watching extension ${extensionName}`));
        }
    }

    public stopWatchingAll(): void {
        this.watchers.forEach((_, extensionName) => {
            this.stopWatching(extensionName);
        });
    }
}
