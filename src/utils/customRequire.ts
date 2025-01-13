import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Guarda uma referência segura do require original
const originalRequire = require;

declare global {
    interface NodeRequire {
        (id: string, default_path?: string): any;
    }
}

// Definição das cores e estilos
const styles = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m'
};

// Função helper para logs estilizados
function logStyled(type: 'info' | 'success' | 'error' | 'warning', message: string) {
    const timestamp = new Date().toLocaleTimeString();
    const icons = {
        info: '📝',
        success: '✅',
        error: '❌',
        warning: '⚠️'
    };
    
    const colors = {
        info: styles.cyan,
        success: styles.green,
        error: styles.red,
        warning: styles.yellow
    };

    console.log(
        `${styles.dim}[${timestamp}]${styles.reset} ${colors[type]}${icons[type]} ${message}${styles.reset}`
    );
}

function ensureDependenciesInstalled(directory: string): void {
    const packageJsonPath = path.join(directory, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
        const nodeModulesPath = path.join(directory, 'node_modules');
        
        if (!fs.existsSync(nodeModulesPath)) {
            logStyled('info', `📦 Installing dependencies in ${directory}...`);
            try {
                execSync('npm install', {
                    stdio: 'inherit',
                    cwd: directory
                });
                logStyled('success', '🎉 Dependencies installed successfully!');
            } catch (error: any) {
                logStyled('error', `Failed to install dependencies: ${error.message}`);
                throw error;
            }
        }
    }
}

function customRequire(id: string, default_path: string = process.cwd()) {
    const previousCwd = process.cwd();
    
    try {
        // Verifica e instala dependências se necessário
        ensureDependenciesInstalled(default_path);
        
        process.cwd = () => default_path;

        if (id.startsWith('./') || id.startsWith('../')) {
            const module = require.main;
            const parentDir = module ? path.dirname(module.filename) : default_path;
            const resolvedPath = path.resolve(parentDir, id);
            logStyled('info', `🔍 Loading local module: ${id}`);
            return originalRequire(resolvedPath);
        }

        const basement_path = path.join(default_path, "node_modules");
        const file_locale = path.join(basement_path, id);

        if (!fs.existsSync(basement_path)) {
            logStyled('warning', `⚠️ No node_modules found at ${basement_path}`);
            return originalRequire(id);
        }

        if (fs.existsSync(file_locale)) {
            if (fs.existsSync(path.join(file_locale, 'package.json'))) {
                logStyled('info', `📘 Reading package.json for ${id}`);
                const pkg_json = JSON.parse(
                    fs.readFileSync(path.join(file_locale, 'package.json'), { encoding: "utf-8" })
                );

                if (pkg_json?.main) {
                    return originalRequire(path.join(file_locale, pkg_json.main));
                } else if (pkg_json?.module) {
                    return originalRequire(path.join(file_locale, pkg_json.module));
                } else if (pkg_json?.exports) {
                    if (pkg_json.exports['.']) {
                        if (pkg_json.exports['.']?.require) {
                            return originalRequire(path.join(file_locale, pkg_json.exports['.'].require));
                        } else if (pkg_json.exports['.']?.import) {
                            return originalRequire(path.join(file_locale, pkg_json.exports['.'].import));
                        }
                    }
                }
            }

            const validExtensions = ['.js', '.cjs', '.mjs', '.cts', '.mts', '.jsx', '.tsx'];
            if (validExtensions.some(ext => file_locale.endsWith(ext))) {
                logStyled('info', `📄 Loading file directly: ${file_locale}`);
                return originalRequire(file_locale);
            }

            if (fs.statSync(file_locale).isDirectory()) {
                const files = fs.readdirSync(file_locale);
                const indexFile = files.find(file => 
                    file.startsWith('index') && 
                    validExtensions.some(ext => file.endsWith(ext))
                );

                if (indexFile) {
                    logStyled('info', `📂 Loading index file from directory: ${indexFile}`);
                    return originalRequire(path.join(file_locale, indexFile));
                }
            }
        }

        const extensions = ['.js', '.json', '.node', '.jsx', '.ts', '.tsx', '/index.js'];
        for (const ext of extensions) {
            const fullPath = file_locale + (file_locale.endsWith(ext) ? '' : ext);
            if (fs.existsSync(fullPath)) {
                logStyled('info', `🔍 Found module with extension: ${ext}`);
                return originalRequire(fullPath);
            }
        }

        logStyled('warning', `⚠️ Falling back to original require for: ${id}`);
        return originalRequire(id);

    } finally {
        process.cwd = () => previousCwd;
    }
}

function installCustomRequire() {
    try {
        // Preserva as propriedades e métodos do require original
        Object.assign(customRequire, originalRequire);
        
        // Atribui o customRequire ao global.require
        global.require = customRequire as any;
        
        logStyled('success', '🚀 Custom require system installed successfully!');
        return true;
    } catch (error) {
        logStyled('error', `Failed to install custom require: ${error}`);
        global.require = originalRequire;
        return false;
    }
}

function isModuleInstalled(moduleName: string, defaultPath: string): boolean {
    const modulePath = path.join(defaultPath, 'node_modules', moduleName);
    const exists = fs.existsSync(modulePath);
    
    if (exists) {
        logStyled('info', `✨ Module ${moduleName} is already installed`);
    } else {
        logStyled('warning', `📢 Module ${moduleName} is not installed`);
    }
    
    return exists;
}

function installModule(moduleName: string, defaultPath: string): void {
    try {
        logStyled('info', `📥 Installing "${moduleName}" in "${defaultPath}"...`);
        execSync(`npm install ${moduleName}`, { 
            stdio: 'inherit', 
            cwd: defaultPath 
        });
        logStyled('success', `🎉 Module "${moduleName}" installed successfully!`);
    } catch (error: any) {
        logStyled('error', `Failed to install "${moduleName}": ${error.message}`);
        throw error;
    }
}

// Inicia o sistema
logStyled('info', '🔧 Initializing custom require system...');

// Instala o require customizado
installCustomRequire();

// Expõe as funções globalmente
global.isModuleInstalled = isModuleInstalled;
global.installModule = installModule;

logStyled('success', '✨ Custom require system is ready to use!');