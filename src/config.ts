import fs from 'fs';
import path from 'path';
import os from 'os';

// Define a interface para a configuração
interface Config {
    chromeProfilePath: string;
    scriptsPath: string;
    defaultPageUrl: string;
    chromeExecutablePath: string;
    chromeConfig: {
        viewportWidth: number;
        viewportHeight: number;
    }
}

// Obtém o diretório do usuário atual
const userHomeDir = os.homedir();

// Configuração padrão
const defaultConfig: Config = {
    chromeProfilePath: "./profiles_data",
    scriptsPath: "./automate",
    defaultPageUrl: "https://www.google.com",
    chromeExecutablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    chromeConfig: {
        viewportWidth: 1360,
        viewportHeight: 768
    }
};

// Função para carregar a configuração do arquivo config.json
export const loadConfig = (): Config => {
    const configPath = path.join(process.cwd(), 'config.json');

    if (!fs.existsSync(configPath)) {
        // Se o arquivo não existir, cria com a configuração padrão
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4));
        console.log(`Config file created at ${configPath} with default settings.`);
    }

    const configFile = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configFile) as Config;
};
