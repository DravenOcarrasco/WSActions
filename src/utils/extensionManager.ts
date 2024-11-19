import {
    existsSync,
    readFileSync,
    mkdirSync,
    rmSync,
    readdirSync
} from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import chalk from 'chalk';
import { loadConfig } from './config';
import { Subscription } from './extensionTypes';
import { zipExtension, restoreZippedExtension, unzipExtension } from './fileOperations';
import { downloadExtension, cleanupTempDir } from './downloadManager';
import { checkAndConfirmUpdate } from './updateManager';

const tempExtensionDir = path.resolve(os.tmpdir(), 'wsaction-extensions');
const backupDir = path.resolve(os.tmpdir(), 'wsaction-extensions-backup');
const config = loadConfig();

// Main function to prepare extensions
export const prepareExtensions = async (utoken: string, reloadModules: () => void): Promise<void> => {
    try {
        console.log(chalk.blue('🔍 Checking active extensions...'));

        const response = await axios.get<Subscription[]>(`${config.api_endpoint}/api/subscriptions`, {
            headers: { 'x-user-id': utoken },
        });
        const subscriptions = response.data;
        const activeSubscriptions = subscriptions.filter(sub => sub.isCurrentlyActive && sub.extension) as Subscription[];
        const activeExtensionNames = activeSubscriptions.map(sub => sub.extension!.name);

        // Clean up old inactive extensions
        if (existsSync(tempExtensionDir)) {
            const existingExtensions = readdirSync(tempExtensionDir);
            for (const existingExtension of existingExtensions) {
                if (!activeExtensionNames.includes(existingExtension)) {
                    const extensionDir = path.resolve(tempExtensionDir, existingExtension);
                    await zipExtension(extensionDir, existingExtension);
                    rmSync(extensionDir, { recursive: true, force: true });
                    console.log(chalk.yellow(`🗑️ Old extension ${existingExtension} removed.`));
                }
            }
        } else {
            mkdirSync(tempExtensionDir, { recursive: true });
        }

        // Process active extensions
        for (const subscription of activeSubscriptions) {
            const extension = subscription.extension!;
            const extensionDir = path.resolve(tempExtensionDir, extension.name);
            const metaFilePath = path.join(extensionDir, 'meta.json');
            let currentVersion: string | null = null;

            if (existsSync(extensionDir)) {
                if (existsSync(metaFilePath)) {
                    const metaData = JSON.parse(readFileSync(metaFilePath, 'utf8'));
                    currentVersion = metaData.version;
                } else {
                    console.warn(chalk.yellow(`⚠️ meta.json not found for extension ${extension.name}. Treating as new installation.`));
                }
            } else {
                // If extension is not installed but backup exists, restore it
                const backupZipPath = path.resolve(backupDir, `${extension.name}.zip`);
                if (existsSync(backupZipPath)) {
                    console.log(chalk.blue(`🔄 Restoring extension ${extension.name} from backup.`));
                    await restoreZippedExtension(extension.name, extensionDir);
                    if (existsSync(metaFilePath)) {
                        const metaData = JSON.parse(readFileSync(metaFilePath, 'utf8'));
                        currentVersion = metaData.version;
                    }
                }
            }

            const shouldUpdate = await checkAndConfirmUpdate(extension.name, currentVersion, extension.version);

            if (shouldUpdate) {
                if (existsSync(extensionDir)) {
                    // Backup current extension before removing
                    await zipExtension(extensionDir, extension.name);
                    rmSync(extensionDir, { recursive: true, force: true });
                    console.log(chalk.yellow(`🗑️ Extension ${extension.name} removed for update.`));
                }

                // Download new version
                const zipFilePath = await downloadExtension(extension);
                if (!zipFilePath) {
                    console.error(chalk.red(`❌ Failed to download extension ${extension.name}.`));
                    continue;
                }

                // Unzip extension
                await unzipExtension(zipFilePath, extensionDir);

                // Remove downloaded zip file
                rmSync(zipFilePath, { force: true });
                console.log(chalk.green(`✅ Extension ${extension.name} installed/updated successfully.`));
            }
        }

    } catch (error) {
        console.error(chalk.red('❌ Error preparing extensions:'), error);
    } finally {
        // Clean up temporary download directory
        cleanupTempDir();
    }
};
