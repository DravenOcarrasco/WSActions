import {
    existsSync,
    mkdirSync,
    createWriteStream,
    rmSync
} from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import ProgressBar from 'progress';
import { ExtensionData } from './extensionTypes';
import { loadConfig } from './config';

const tempDir = path.resolve(os.tmpdir(), 'extensions-download');
const config = loadConfig();

// Function to download extension with progress bar
export const downloadExtension = async (extension: ExtensionData): Promise<string | null> => {
    const fileUrl = `${config.api_endpoint}/${extension.extensionFilePath}`;
    const filePath = path.resolve(tempDir, `${extension.name}-${extension.version}.zip`);
    
    if (!existsSync(tempDir)) {
        mkdirSync(tempDir, { recursive: true });
    }
    
    const writer = createWriteStream(filePath);
    
    try {
        const response = await axios({
            url: fileUrl,
            method: 'GET',
            responseType: 'stream',
        });

        // Get total file size for progress bar
        const totalLength = parseInt(response.headers['content-length'], 10);

        // Initialize progress bar with extension name
        const progressBar = new ProgressBar(`Downloading ${extension.name} [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 16,
            total: totalLength,
        });

        // Update progress bar as download progresses
        response.data.on('data', (chunk: any) => progressBar.tick(chunk.length));
        response.data.pipe(writer);

        return new Promise<string | null>((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`Download of extension ${extension.name} completed.`);
                resolve(filePath);
            });
            writer.on('error', (err) => {
                console.error(`Error writing extension file ${extension.name}:`, err);
                reject(null);
            });
        });
    } catch (error) {
        console.error(`Error downloading extension ${extension.name}:`, error);
        return null;
    }
};

// Function to clean up temporary download directory
export const cleanupTempDir = (): void => {
    if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true });
        console.log(`🧹 Temporary directory ${tempDir} removed.`);
    }
};
