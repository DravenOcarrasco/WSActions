import { existsSync, readFileSync, mkdirSync, createWriteStream, rmSync, readdirSync, createReadStream } from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import unzipper from 'unzipper';
import inquirer from 'inquirer';
import archiver from 'archiver';
import ProgressBar from 'progress'; // Importa a barra de progresso
import { loadConfig } from './config';
import { isVersionNewer } from './versionChecker';

const tempExtensionDir = path.resolve(os.tmpdir(), 'wsaction-extensions');
const tempDir = path.resolve(os.tmpdir(), 'extensions-download');
const backupDir = path.resolve(os.tmpdir(), 'wsaction-extensions-backup');
const config = loadConfig();

// Função para zipar uma extensão
const zipExtension = (extensionDir: string, extensionName: string) => {
    const outputZipPath = path.resolve(backupDir, `${extensionName}.zip`);
    if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
    }

    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Nível máximo de compressão
    });

    return new Promise<void>((resolve, reject) => {
        archive.directory(extensionDir, false);
        archive.pipe(output);

        archive.on('end', () => {
            console.log(`Extensão ${extensionName} foi arquivada.`);
            resolve();
        });

        archive.on('error', (err: any) => {
            console.error(`Erro ao arquivar a extensão ${extensionName}:`, err);
            reject(err);
        });

        archive.finalize();
    });
};

// Função para restaurar uma extensão zipada
const restoreZippedExtension = async (extensionName: string, extensionDir: string) => {
    const zipPath = path.resolve(backupDir, `${extensionName}.zip`);
    if (existsSync(zipPath)) {
        const unzipStream = unzipper.Extract({ path: extensionDir });
        createReadStream(zipPath).pipe(unzipStream);

        return new Promise<void>((resolve, reject) => {
            unzipStream.on('close', () => {
                console.log(`Extensão ${extensionName} foi restaurada.`);
                resolve();
            });
            unzipStream.on('error', reject);
        });
    }
};

// Função para baixar a extensão com barra de progresso
const downloadExtension = async (extension: any) => {
    const fileUrl = `${config.api_endpoint}/${extension.extension.extensionFilePath}`;
    const filePath = path.resolve(tempDir, `${extension.extension.name}-${extension.extension.version}.zip`);
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

        // Tamanho total do arquivo para mostrar o progresso
        const totalLength = parseInt(response.headers['content-length'], 10);

        // Inicializa a barra de progresso com o nome da extensão
        const progressBar = new ProgressBar(`Baixando ${extension.extension.name} [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 16,
            total: totalLength,
        });

        // Atualiza a barra de progresso conforme o download avança
        response.data.on('data', (chunk: any) => progressBar.tick(chunk.length));
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error(`Erro ao fazer o download da extensão ${extension.extension.name}:`, error);
    }
};

// Função para descompactar a extensão
const unzipExtension = async (zipFilePath: any, outputDir: any) => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    try {
        await unzipper.Open.file(zipFilePath)
            .then((d) => d.extract({ path: outputDir }));
    } catch (error) {
        console.error('Erro ao descompactar a extensão:', error);
    }
};

// Função para exibir o menu de atualização sem o timer
const showUpdateMenu = async (extensionName: string, currentVersion: string, newVersion: string) => {
    return inquirer.prompt([
        {
            type: 'list',
            name: 'update',
            message: `Nova versão da extensão ${extensionName} disponível (atual: ${currentVersion}, nova: ${newVersion}). Atualizar?`,
            choices: [
                { name: 'Não, manter a versão atual', value: false },
                { name: 'Sim, atualizar', value: true }
            ]
        }
    ]).then((answers) => answers.update);
};

// Função principal para preparar as extensões
export const prepareExtensions = async (utoken: string) => {
    try {
        const response = await axios.get(`${config.api_endpoint}/api/subscriptions`, {
            headers: { 'x-user-id': `${utoken}` },
        });
        const subscriptions = response.data;
        const extensionNames = subscriptions.filter((sub: any) => sub.isCurrentlyActive && sub.extension)
            .map((sub: any) => sub.extension.name);

        // Limpa extensões antigas
        if (existsSync(tempExtensionDir)) {
            const existingExtensions = readdirSync(tempExtensionDir);
            for (const existingExtension of existingExtensions) {
                if (!extensionNames.includes(existingExtension)) {
                    await zipExtension(path.resolve(tempExtensionDir, existingExtension), existingExtension);
                    rmSync(path.resolve(tempExtensionDir, existingExtension), { recursive: true, force: true });
                }
            }
        } else {
            mkdirSync(tempExtensionDir, { recursive: true });
        }

        // Processa as extensões ativas
        for (const subscription of subscriptions) {
            if (subscription.isCurrentlyActive && subscription.extension) {
                const extensionDir = path.resolve(tempExtensionDir, subscription.extension.name);
                const metaFilePath = path.join(extensionDir, 'meta.json');
                const currentVersion = existsSync(metaFilePath)
                    ? JSON.parse(readFileSync(metaFilePath, 'utf8')).version
                    : null;

                // Verifica se a extensão foi arquivada
                if (!existsSync(extensionDir) && existsSync(path.resolve(backupDir, `${subscription.extension.name}.zip`))) {
                    console.log(`Restaurando a extensão ${subscription.extension.name}.`);
                    await restoreZippedExtension(subscription.extension.name, extensionDir);
                }
                
                let permission = true; 

                // Verifica se há uma nova versão disponível
                if (currentVersion && isVersionNewer(currentVersion, subscription.extension.version)) {
                    if (!config.auto_update_extensions) {
                        permission = await showUpdateMenu(subscription.extension.name, currentVersion, subscription.extension.version);
                    }
                }

                if (!currentVersion && permission){
                    const zipFilePath = await downloadExtension(subscription);
                    await unzipExtension(zipFilePath, extensionDir);
                }
            }
        }
    } catch (error) {
        console.error('Erro ao obter as assinaturas:', error);
    } finally {
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
        }
    }
};
