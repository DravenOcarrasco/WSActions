import fs from 'fs';
import path from 'path';

// Define a interface para a configuração
interface Config {
    chromeProfilePath: string;
    scriptsPath: string;
    defaultPageUrl: string;
}

// Função para carregar a configuração do arquivo config.json
export const loadConfig = (): Config => {
    const configPath = path.join(process.cwd(), 'config.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found at ${configPath}`);
    }

    const configFile = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configFile) as Config;
};
