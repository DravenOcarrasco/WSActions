import {
    existsSync,
    mkdirSync,
    createWriteStream,
    createReadStream,
    unlinkSync,
    rmSync
} from 'fs';
import path from 'path';
import unzipper from 'unzipper';
import archiver from 'archiver';
import os from 'os';

export const backupDir = path.resolve(os.tmpdir(), 'wsaction-extensions-backup');

// Function to remove a file
export const removeFile = (filePath: string): void => {
    if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`File ${filePath} has been removed.`);
    } else {
        console.warn(`File ${filePath} does not exist.`);
    }
};

// Function to remove a directory and its contents
export const removeDirectory = (dirPath: string): void => {
    if (existsSync(dirPath)) {
        rmSync(dirPath, { recursive: true, force: true });
        console.log(`Directory ${dirPath} has been removed.`);
    } else {
        console.warn(`Directory ${dirPath} does not exist.`);
    }
};

// Function to zip an extension
export const zipExtension = (extensionDir: string, extensionName: string): Promise<void> => {
    const outputZipPath = path.resolve(backupDir, `${extensionName}.zip`);
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
    }

    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression level
    });

    return new Promise<void>((resolve, reject) => {
        archive.directory(extensionDir, false);
        archive.pipe(output);

        archive.on('end', () => {
            console.log(`Extension ${extensionName} has been archived.`);
            resolve();
        });

        archive.on('error', (err: any) => {
            console.error(`Error archiving extension ${extensionName}:`, err);
            reject(err);
        });

        archive.finalize();
    });
};

// Function to restore a zipped extension
export const restoreZippedExtension = async (extensionName: string, extensionDir: string): Promise<void> => {
    const zipPath = path.resolve(backupDir, `${extensionName}.zip`);
    if (existsSync(zipPath)) {
        const unzipStream = unzipper.Extract({ path: extensionDir });
        createReadStream(zipPath).pipe(unzipStream);

        return new Promise<void>((resolve, reject) => {
            unzipStream.on('close', () => {
                console.log(`Extension ${extensionName} has been restored.`);
                resolve();
            });
            unzipStream.on('error', reject);
        });
    } else {
        console.warn(`Backup for extension ${extensionName} not found.`);
    }
};

// Function to unzip an extension
export const unzipExtension = async (zipFilePath: string, outputDir: string): Promise<void> => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    try {
        await unzipper.Open.file(zipFilePath)
            .then((d) => d.extract({ path: outputDir }));
        console.log(`Extension unzipped to ${outputDir}.`);
    } catch (error) {
        console.error('Error unzipping extension:', error);
    }
};
