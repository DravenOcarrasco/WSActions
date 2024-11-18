import { Application, Router } from 'express';
import { Socket } from 'socket.io';

export interface Extension {
    NAME: string;
    ENABLED: boolean;
    IOEVENTS: Record<string, { _function: (...args: any[]) => void }>;
    COMMANDS: Record<string, { _function: (...args: any[]) => void; description: string }>;
    ROUTER: Router;
    onInitialize: () => void;
    onError?: (error: any) => void;
    WEB_SCRIPTS: string[],
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
