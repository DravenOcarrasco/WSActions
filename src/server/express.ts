import express, { Application } from 'express';
import path from 'path';
import cors from 'cors';
import { loadConfig } from '../utils/config';
import { cwd } from 'process';
import { readFile } from 'fs/promises';

const config = loadConfig();

// Definir o diretório de execução
const execPath = process.execPath;
const execDir = execPath.includes("bun.exe") || execPath.includes("node.exe")
    ? path.dirname(__dirname)
    : path.dirname(execPath);

export function createExpressApp(): Application {
    const app: Application = express();
    app.use(cors());

    // Servir arquivos estáticos
    app.use(express.static(path.join(process.cwd(), "public")));

    // Middleware personalizado para /client.js
    app.get('/client.js', async (req, res) => {
        const filePath = path.join(cwd(), 'scripts', 'injector.js');
        const additionalScripts = `
            if(window.injectorPort == undefined) window.injectorPort = '${config.http.port}';
        `;

        try {
            const data = await readFile(filePath, 'utf8');
            const modifiedContent = additionalScripts + data;
            
            res.setHeader('Content-Type', 'application/javascript');
            res.send(modifiedContent);
        } catch (err) {
            console.log(err)
            res.status(500).send('Internal Server Error');
        }
    });

    return app;
}
