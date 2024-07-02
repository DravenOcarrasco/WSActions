"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShortcutWithStringRunStyle = exports.createShortcut = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const windows_shortcuts_1 = __importDefault(require("windows-shortcuts"));
/**
 * Mapeamento dos valores de estilo de execução para os valores esperados pela biblioteca.
 */
const runStyleMap = {
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
const createShortcut = (options) => {
    return new Promise((resolve, reject) => {
        const shortcutDir = path_1.default.dirname(options.shortcutPath);
        // Verifica se o diretório onde o atalho será criado existe, senão cria
        if (!fs_1.default.existsSync(shortcutDir)) {
            fs_1.default.mkdirSync(shortcutDir, { recursive: true });
        }
        windows_shortcuts_1.default.create(options.shortcutPath, {
            target: options.target,
            args: options.args,
            workingDir: options.workingDir,
            runStyle: options.runStyle,
            icon: options.icon
        }, (err) => {
            if (err) {
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
};
exports.createShortcut = createShortcut;
/**
 * Função auxiliar para criar atalhos com runStyle como string
 *
 * @param options - Opções para a criação do atalho.
 * @returns Promise<void>
 */
const createShortcutWithStringRunStyle = (options) => {
    return createShortcut(Object.assign(Object.assign({}, options), { runStyle: options.runStyle ? runStyleMap[options.runStyle] : undefined }));
};
exports.createShortcutWithStringRunStyle = createShortcutWithStringRunStyle;
