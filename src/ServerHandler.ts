import { existsSync, writeFileSync, readFileSync, mkdirSync, createWriteStream, rmSync, readdirSync } from 'fs';
import path from 'path';
import express from 'express';
import { spawn } from 'child_process';
import { Encripty, generateUniqueKey } from './utils/encrypt';
import { startWebSocketServer } from './modules/cli-websocket';
import { loadConfig, tempExtensionDir } from './utils/config';
import cors from 'cors';
import os from 'os';
import unzipper from 'unzipper';
import axios from 'axios';

import {createOrLoadIdentityFile, updateIdentityFile} from "./utils/identity"
import { prepareExtensions } from './utils/extensionManager';
const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));


const config = loadConfig();

const tempDir = path.resolve(os.tmpdir(), 'extensions-download');

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
        response.data.pipe(writer);
        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(filePath));
            writer.on('error', reject);
        });
    } catch (error) {
        console.error('Erro ao fazer o download da extensão:', error);
    }
};

// Função de autenticação baseada no arquivo de identidade
const authServer = async () => {
    const identity = createOrLoadIdentityFile();
    return {
        existUser: !!identity.user_id,
        user_id: identity.user_id,
    };
};

// Função para inicializar o servidor após a autenticação
const serverInit = async (IoPort: number) => {
    let io = await startWebSocketServer();
    io?.listen(IoPort);
    const { scheduleProfiles } = await import('./modules/schedule');
    scheduleProfiles();
};

// Função para abrir o Google Chrome com base no sistema operacional
const openChrome = (url: string) => {
    const platform = os.platform();
    let browserOpened = false;

    try {
        if (platform === 'darwin') {
            spawn('open', ['-a', 'Google Chrome', url], { detached: true, stdio: 'ignore' }).unref();
            browserOpened = true;
        } else if (platform === 'win32') {
            const chromePaths = [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
            ];

            let chromePath = chromePaths.find((chromePath) => existsSync(chromePath));

            if (chromePath) {
                spawn(chromePath, [url], { detached: true, stdio: 'ignore' }).unref();
                browserOpened = true;
            } else {
                console.error('Google Chrome não encontrado nos locais padrão.');
            }
        } else if (platform === 'linux') {
            spawn('google-chrome', [url], { detached: true, stdio: 'ignore' }).unref();
        } else {
            console.error(`Sistema operacional não suportado: ${platform}`);
        }
    } catch (error) {
        console.error('Erro ao tentar abrir o Google Chrome:', error);
    }

    if (!browserOpened) {
        console.log(`Por favor, abra manualmente o seguinte URL: ${url}`);
    }
};

// API para registrar o user_id
app.post('/register', (req, res) => {
    const { user_id } = req.body;
    if (!user_id) {
        return res.status(400).json({ error: 'user_id é obrigatório' });
    }
    updateIdentityFile(user_id);
    res.json({ message: 'user_id registrado com sucesso' });
    setTimeout(() => {
        process.exit(0);
    }, 3000);
});

// Função principal que chama a autenticação e inicializa o servidor se a autenticação for válida
export default async (IoPort: number) => {
    const { existUser, user_id } = await authServer();
    if (existUser) {
        await prepareExtensions(user_id as string);
        const { default: api } = await import('./api');
        await serverInit(IoPort);
    } else {
        app.listen(9513, async () => {
            openChrome(`${config.dashboard_endpoint}`);
        });
    }
};
