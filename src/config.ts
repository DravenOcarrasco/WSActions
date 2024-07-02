import fs from 'fs';
import path from 'path';
import os from 'os';

// Define a interface para a configuração
interface Config {
    chromeProfilePath: string;
    scriptsPath: string;
    defaultPageUrl: string;
}

// Obtém o diretório do usuário atual
const userHomeDir = os.homedir();

// Configuração padrão
const defaultConfig: Config = {
    chromeProfilePath: path.join(userHomeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
    scriptsPath: "./scripts/injector.js",
    defaultPageUrl: "https://www.google.com"
};

// Função para carregar a configuração do arquivo config.json
export const loadConfig = (): Config => {
    const configPath = path.join(process.cwd(), 'config.json');

    if (!fs.existsSync(configPath)) {
        // Se o arquivo não existir, cria com a configuração padrão
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        console.log(`Config file created at ${configPath} with default settings.`);
    }

    const configFile = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configFile) as Config;
};
