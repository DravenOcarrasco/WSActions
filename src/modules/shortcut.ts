import path from 'path';
import fs from 'fs';
import ws from 'windows-shortcuts';

/**
 * Interface para definir os parâmetros de criação do atalho.
 */
interface ShortcutOptions {
    target: string;  // Caminho do arquivo de destino
    shortcutPath: string;  // Caminho onde o atalho será criado
    args?: string;  // Argumentos a serem passados para o executável
    workingDir?: string;  // Diretório de trabalho
    runStyle?: 1 | 3 | 7;  // Estilo de execução
    icon?: string;  // Caminho para o ícone
}

/**
 * Mapeamento dos valores de estilo de execução para os valores esperados pela biblioteca.
 */
const runStyleMap: { [key: string]: 1 | 3 | 7 } = {
    normal: 1,
    maximized: 3,
    minimized: 7
};

/**
 * Cria um atalho no Windows.
 * 
 * @param options - Opções para a criação do atalho.
 * @returns Promise<void>
 */
const createShortcut = (options: ShortcutOptions): Promise<void> => {
    return new Promise((resolve, reject) => {
        const shortcutDir = path.dirname(options.shortcutPath);

        // Verifica se o diretório onde o atalho será criado existe, senão cria
        if (!fs.existsSync(shortcutDir)) {
            fs.mkdirSync(shortcutDir, { recursive: true });
        }

        ws.create(options.shortcutPath, {
            target: options.target,
            args: options.args,
            workingDir: options.workingDir,
            runStyle: options.runStyle,
            icon: options.icon
        }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

/**
 * Função auxiliar para criar atalhos com runStyle como string
 * 
 * @param options - Opções para a criação do atalho.
 * @returns Promise<void>
 */
const createShortcutWithStringRunStyle = (options: Omit<ShortcutOptions, 'runStyle'> & { runStyle?: 'normal' | 'maximized' | 'minimized' }): Promise<void> => {
    return createShortcut({
        ...options,
        runStyle: options.runStyle ? runStyleMap[options.runStyle] : undefined
    });
};

export {
    createShortcut,
    createShortcutWithStringRunStyle,
    ShortcutOptions
};
