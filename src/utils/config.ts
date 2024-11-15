import fs from 'fs';
import path from 'path';
import os from 'os';

interface Relay {
    enabled: boolean,
    mode: "master"|"slave",
    ip: string,
    port: number
}
// Define a interface para a configuração
interface Config {
    chromeProfilePath: string;
    scriptsPath: string;
    defaultPageUrl: string;
    chromeExecutablePath: string;
    chromeConfig: {
        viewportWidth: number;
        viewportHeight: number;
    },
    http: {
        port: number
    },
    dashboard_endpoint: string,
    api_endpoint: string,
    auto_update_extensions: boolean,
    auto_update_ws_action: boolean,
    relay: Relay;
}

// Obtém o diretório do usuário atual
const userHomeDir = os.homedir();

// Configuração padrão
const defaultConfig: Config = {
    chromeProfilePath: "./profiles_data",
    scriptsPath: "./automate",
    defaultPageUrl: "https://www.google.com",
    chromeExecutablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    chromeConfig: {
        viewportWidth: 1360,
        viewportHeight: 768
    },
    http: {
        port: 9514
    },
    dashboard_endpoint: "https://wsaction.creativepetabyte.com/sync",
    api_endpoint: "https://wsactionapi.creativepetabyte.com",
    auto_update_extensions: false,
    auto_update_ws_action: true,
    relay:{
        ip: "127.0.0.1",
        port: 9515,
        enabled: false,
        mode: "master"
    }
};

/**
 * Função responsável por limpar e corrigir a configuração carregada.
 * Ela remove quaisquer campos extras que não estão presentes na configuração padrão
 * e adiciona campos ausentes com os valores padrão definidos.
 * 
 * @param {Partial<Config>} loadedConfig - Configuração carregada do arquivo, que pode estar incompleta ou ter campos extras.
 * @param {Config} defaultConfig - Configuração padrão com todos os campos esperados e seus valores padrão.
 * @returns {Config} - Retorna uma configuração completa e válida, onde os campos ausentes foram preenchidos e os campos extras removidos.
 */
const cleanConfig = (loadedConfig: any, defaultConfig: any): Config => {
    const cleanedConfig: any = {};

    for (const key in defaultConfig) {
        if (typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {
            // Se for um objeto, precisamos limpar recursivamente
            cleanedConfig[key] = cleanConfig(loadedConfig[key] || {}, defaultConfig[key]);
        } else {
            // Se a chave existir no arquivo carregado, usamos ela, caso contrário, usamos o valor padrão
            cleanedConfig[key] = key in loadedConfig ? loadedConfig[key] : defaultConfig[key];
        }
    }

    return cleanedConfig;
};

// Função para carregar a configuração do arquivo config.json
export const loadConfig = (): Config => {
    const configPath = path.join(process.cwd(), 'config.json');

    let loadedConfig: Partial<Config> = {};

    if (fs.existsSync(configPath)) {
        const configFile = fs.readFileSync(configPath, 'utf-8');
        loadedConfig = JSON.parse(configFile) as Partial<Config>;
    }

    // Limpar a configuração removendo campos que não existem mais e adicionando campos faltantes
    const finalConfig = cleanConfig(loadedConfig, defaultConfig);

    // Se houver diferenças, salva o arquivo de volta
    if (JSON.stringify(finalConfig) !== JSON.stringify(loadedConfig)) {
        fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 4));
        console.log(`Config file at ${configPath} updated with missing fields and removed deprecated fields.`);
    }

    return finalConfig;
};

// Obter o diretório temporário padrão do sistema
const tempDir = os.tmpdir();
export const tempExtensionDir = path.resolve(tempDir, 'wsaction-extensions');
export const extensionsPath = path.resolve(process.cwd(), 'extensions');
export const storagePath = path.resolve(process.cwd(), 'storage.json');