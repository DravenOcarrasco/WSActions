import {
    existsSync,
    readFileSync,
    mkdirSync,
    createWriteStream,
    rmSync,
    readdirSync,
    createReadStream
} from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import unzipper from 'unzipper';
import inquirer from 'inquirer';
import archiver from 'archiver';
import ProgressBar from 'progress';
import { loadConfig } from './config';
import { isVersionNewer } from './versionChecker';


const tempExtensionDir = path.resolve(os.tmpdir(), 'wsaction-extensions');
const tempDir = path.resolve(os.tmpdir(), 'extensions-download');
const backupDir = path.resolve(os.tmpdir(), 'wsaction-extensions-backup');
const config = loadConfig();

// Interfaces para tipagem
interface ExtensionData {
    name: string;
    version: string;
    extensionFilePath: string;
}

interface Subscription {
    isCurrentlyActive: boolean;
    extension?: ExtensionData;
}

interface ExtensionBackup {
    name: string;
    zipPath: string;
}

// Função para zipar uma extensão
const zipExtension = (extensionDir: string, extensionName: string): Promise<void> => {
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
const restoreZippedExtension = async (extensionName: string, extensionDir: string): Promise<void> => {
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
    } else {
        console.warn(`Backup da extensão ${extensionName} não encontrado.`);
    }
};

// Função para baixar a extensão com barra de progresso
const downloadExtension = async (extension: ExtensionData): Promise<string | null> => {
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

        // Tamanho total do arquivo para mostrar o progresso
        const totalLength = parseInt(response.headers['content-length'], 10);

        // Inicializa a barra de progresso com o nome da extensão
        const progressBar = new ProgressBar(`Baixando ${extension.name} [:bar] :percent :etas`, {
            width: 40,
            complete: '=',
            incomplete: ' ',
            renderThrottle: 16,
            total: totalLength,
        });

        // Atualiza a barra de progresso conforme o download avança
        response.data.on('data', (chunk: any) => progressBar.tick(chunk.length));
        response.data.pipe(writer);

        return new Promise<string | null>((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`Download da extensão ${extension.name} concluído.`);
                resolve(filePath);
            });
            writer.on('error', (err) => {
                console.error(`Erro ao escrever o arquivo da extensão ${extension.name}:`, err);
                reject(null);
            });
        });
    } catch (error) {
        console.error(`Erro ao fazer o download da extensão ${extension.name}:`, error);
        return null;
    }
};

// Função para descompactar a extensão
const unzipExtension = async (zipFilePath: string, outputDir: string): Promise<void> => {
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }
    try {
        await unzipper.Open.file(zipFilePath)
            .then((d) => d.extract({ path: outputDir }));
        console.log(`Extensão descompactada em ${outputDir}.`);
    } catch (error) {
        console.error('Erro ao descompactar a extensão:', error);
    }
};

// Função para exibir o menu de atualização sem o timer
const showUpdateMenu = async (extensionName: string, currentVersion: string, newVersion: string): Promise<boolean> => {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'update',
            message: `Nova versão da extensão ${extensionName} disponível (atual: ${currentVersion}, nova: ${newVersion}). Atualizar?`,
            choices: [
                { name: 'Não, manter a versão atual', value: false },
                { name: 'Sim, atualizar', value: true }
            ]
        }
    ]);
    return answers.update;
};

// Função principal para preparar as extensões
export const prepareExtensions = async (utoken: string, reloadModules: () => void): Promise<void> => {
    try {
        const response = await axios.get<Subscription[]>(`${config.api_endpoint}/api/subscriptions`, {
            headers: { 'x-user-id': utoken },
        });
        const subscriptions = response.data;
        const activeSubscriptions = subscriptions.filter(sub => sub.isCurrentlyActive && sub.extension) as Subscription[];
        const activeExtensionNames = activeSubscriptions.map(sub => sub.extension!.name);

        // Limpa extensões antigas que não estão mais ativas
        if (existsSync(tempExtensionDir)) {
            const existingExtensions = readdirSync(tempExtensionDir);
            for (const existingExtension of existingExtensions) {
                if (!activeExtensionNames.includes(existingExtension)) {
                    const extensionDir = path.resolve(tempExtensionDir, existingExtension);
                    await zipExtension(extensionDir, existingExtension);
                    rmSync(extensionDir, { recursive: true, force: true });
                    console.log(`Extensão antiga ${existingExtension} removida.`);
                }
            }
        } else {
            mkdirSync(tempExtensionDir, { recursive: true });
        }

        // Processa as extensões ativas
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
                    console.warn(`Arquivo meta.json não encontrado para a extensão ${extension.name}. Considerando como nova instalação.`);
                }
            } else {
                // Se a extensão não está instalada, mas backup existe, restaure
                const backupZipPath = path.resolve(backupDir, `${extension.name}.zip`);
                if (existsSync(backupZipPath)) {
                    console.log(`Restaurando a extensão ${extension.name} a partir do backup.`);
                    await restoreZippedExtension(extension.name, extensionDir);
                    if (existsSync(metaFilePath)) {
                        const metaData = JSON.parse(readFileSync(metaFilePath, 'utf8'));
                        currentVersion = metaData.version;
                    }
                }
            }

            let shouldUpdate = false;

            if (currentVersion) {
                if (isVersionNewer(currentVersion, extension.version)) {
                    if (config.auto_update_extensions) {
                        shouldUpdate = true;
                        console.log(`Atualizando automaticamente a extensão ${extension.name} para a versão ${extension.version}.`);
                    } else {
                        const permission = await showUpdateMenu(extension.name, currentVersion, extension.version);
                        shouldUpdate = permission;
                    }
                } else {
                    console.log(`A extensão ${extension.name} já está na versão mais recente (${currentVersion}).`);
                }
            } else {
                // Nova instalação
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                if (existsSync(extensionDir)) {
                    // Zipar a extensão atual antes de remover (backup)
                    await zipExtension(extensionDir, extension.name);
                    rmSync(extensionDir, { recursive: true, force: true });
                    console.log(`Extensão ${extension.name} removida para atualização.`);
                }

                // Baixa a nova versão
                const zipFilePath = await downloadExtension(extension);
                if (!zipFilePath) {
                    console.error(`Falha ao baixar a extensão ${extension.name}.`);
                    continue;
                }

                // Descompacta a extensão
                await unzipExtension(zipFilePath, extensionDir);

                // Remove o arquivo zip baixado
                rmSync(zipFilePath, { force: true });
                console.log(`Extensão ${extension.name} instalada/atualizada com sucesso.`);
            }
        }

        // Após atualizar as extensões, chame reloadModules para reiniciar o servidor
        // console.log(chalk.blue('Atualizações das extensões concluídas. Reiniciando o servidor para aplicar as mudanças.'));
        // reloadModules();

    } catch (error) {
        console.error('Erro ao preparar as extensões:', error);
    } finally {
        // Limpa o diretório de downloads temporários
        if (existsSync(tempDir)) {
            rmSync(tempDir, { recursive: true, force: true });
            console.log(`Diretório temporário ${tempDir} removido.`);
        }
    }
};
