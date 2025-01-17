import { Application, Router } from 'express';
import { Server } from 'socket.io';
import readline from 'readline';

// Types para loadAllExtensions
export interface LoadAllExtensionsConfig {
    WSIO: Server | null;
    APP: Application | null;
    RL: readline.Interface | null;
    STORAGE: Record<string, any>;
    saveStorage: () => void;
    EXTENSIONS: ExtensionsContainer;
    COMMANDS: Commands;
}

export interface LoadExtensionsConfig {
    EXTENSION_PATH: string;
    WSIO: Server | null;
    APP: Application | null;
    RL: readline.Interface | null;
    STORAGE: Record<string, any>;
    saveStorage: () => void;
    EXTENSIONS: {
        ENABLED: Extension[];
        DISABLED: Extension[];
    };
    COMMANDS: Commands;
    EXPRESS: any;
}

export interface ProcessExtensionConfig {
    extension: Extension;
    EXTENSIONS: {
        ENABLED: Extension[];
        DISABLED: Extension[];
    };
    STORAGE: Record<string, any>;
    COMMANDS: Commands;
    WSIO: Server | null;
}

export interface Extension {
    NAME: string;
    ENABLED: boolean;
    IOEVENTS: Record<string, { _function: (...args: any[]) => void }>;
    COMMANDS: Record<string, { _function: (...args: any[]) => void; description: string }>;
    ROUTER: Router;
    onInitialize: () => void;
    onError?: (error: any) => void;
    WEB_SCRIPTS: string[],
    GLOBAL_SCRIPTS: string[],
    EXTENSION_PATH?: string,
    ID: string
}

export interface Command {
    _function: (...args: any[]) => void;
    description?: string;
}

export interface Commands {
    IO: Record<string, Record<string, Command>>;
    CLI: Record<string, Record<string, Command>>;
}

export interface StorageHandlers {
    save: (data: any) => void;
    load: (data: any) => any;
    delete: (data: any) => void;
}

export interface ExtensionsContainer {
    ENABLED: Extension[];
    DISABLED: Extension[];
}

export interface DefineExtensionRoutesConfig {
    APP: Application | null;
    EXT: Extension;
    extensionsPath: string;
    BASENAME: string;
}

export interface ExtensionInitConfig {
    WSIO: Server | null;
    APP: Application | null;
    RL: readline.Interface | null;
    STORAGE: {
        data: Record<string, any>;
        save: () => void;
    };
    EXPRESS: any;
    WEB_SCRIPTS?: string[];
    GLOBAL_SCRIPTS?: string[];
    EXTENSION_PATH: string;
    ID: string;
}
