import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
const old = global.require
//@ts-ignore
global.require = function (id, default_path: string = process.cwd()) {

    const basement_path = path.join(default_path!, "node_modules");
    const file_locale = path.join(basement_path, id);
    if (old.main?.path.startsWith(process.cwd()))
        return old(id);

    if (!fs.existsSync(basement_path)) {
        return old(id);
    }

    if (fs.existsSync(file_locale)) {
        if (fs.existsSync(path.join(file_locale, 'package.json'))) {
            const pkg_json = JSON.parse(fs.readFileSync(path.join(file_locale, 'package.json'), { encoding: "utf-8" }));
            if (pkg_json?.main) {
                return old(path.join(file_locale, pkg_json?.main))
            } else if (pkg_json?.module) {
                return old(path.join(file_locale, pkg_json?.module))
            } else if (pkg_json?.exports) {
                if (pkg_json?.exports['.']) {
                    if (pkg_json?.exports['.']?.require) {
                        return old(path.join(file_locale, pkg_json?.exports['.']?.require))
                    } else if (pkg_json?.exports['.']?.import) {
                        return old(path.join(file_locale, pkg_json?.exports['.']?.import))
                    }
                } else {
                    throw new Error("Module not detect or not found, check package.json of node_modules");
                }
            } else {
                throw new Error("Module not detect or not found, check package.json of node_modules");
            }
        } else {
            if (
                file_locale.endsWith('.js') ||
                file_locale.endsWith('.cjs') ||
                file_locale.endsWith('.mjs') ||
                file_locale.endsWith('.cts') ||
                file_locale.endsWith('.mts') ||
                file_locale.endsWith('.jsx') ||
                file_locale.endsWith('.tsx')
            ) {
                return old(file_locale);
            } else {
                // é um repositorio mais possivelmente é um index
                const data = fs.readdirSync(file_locale);

                if (!data.length) {
                    throw new Error("Module not detect or not found, check package.json of node_modules");
                }

                let _founded_true_filepath = null;
                data.forEach(filepath => {
                    if (filepath.split("/").pop()?.startsWith("index")) {
                        _founded_true_filepath = filepath;
                    }
                })

                if (!_founded_true_filepath) {
                    throw new Error("Module not detect or not found, check package.json of node_modules");
                }
                return old(_founded_true_filepath);
            }
        }
    } else {
        // possivelmente é um modulo virtual
        return old(id);
    }
}

/**
 * Função para verificar se um módulo está instalado
 * @param moduleName Nome do módulo a ser verificado
 * @param defaultPath Caminho padrão onde verificar o módulo
 * @returns Retorna true se o módulo estiver instalado, caso contrário, false
 */
function isModuleInstalled(moduleName: string, defaultPath: string): boolean {
    const modulePath = path.join(defaultPath, 'node_modules', moduleName);
    return fs.existsSync(modulePath);
}

/**
 * Função para instalar um módulo usando npm no defaultPath
 * @param moduleName Nome do módulo a ser instalado
 * @param defaultPath Caminho padrão onde instalar o módulo
 */
function installModule(moduleName: string, defaultPath: string): void {
    try {
        console.log(`Instalando o módulo "${moduleName}" na pasta "${defaultPath}"...`);
        execSync(`npm install ${moduleName}`, { stdio: 'inherit', cwd: defaultPath });
        console.log(`Módulo "${moduleName}" instalado com sucesso.`);
    } catch (error: any) {
        console.error(`Erro ao instalar o módulo "${moduleName}":`, error.message);
        throw error;
    }
}

//@ts-ignore
global.isModuleInstalled = isModuleInstalled;
//@ts-ignore
global.installModule     = installModule;