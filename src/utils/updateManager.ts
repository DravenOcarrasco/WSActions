import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadConfig } from './config';
import { isVersionNewer } from './versionChecker';

const config = loadConfig();

// Function to display update menu without timer
export const showUpdateMenu = async (extensionName: string, currentVersion: string, newVersion: string): Promise<boolean> => {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'update',
            message: `New version of extension ${extensionName} available (current: ${currentVersion}, new: ${newVersion}). Update?`,
            choices: [
                { name: 'No, keep current version', value: false },
                { name: 'Yes, update', value: true }
            ]
        }
    ]);
    return answers.update;
};

// Function to check if update is needed and handle user interaction
export const checkAndConfirmUpdate = async (
    extensionName: string,
    currentVersion: string | null,
    newVersion: string
): Promise<boolean> => {
    if (!currentVersion) {
        return true; // New installation
    }

    if (isVersionNewer(currentVersion, newVersion)) {
        if (config.auto_update_extensions) {
            console.log(chalk.green(`⬆️ Automatically updating extension ${extensionName} to version ${newVersion}.`));
            return true;
        } else {
            return await showUpdateMenu(extensionName, currentVersion, newVersion);
        }
    }

    console.log(chalk.green(`✅ Extension ${extensionName} is already at the latest version (${currentVersion}).`));
    return false;
};
