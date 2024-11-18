import fs from 'fs';
import path from 'path';
import { StorageHandlers } from './types';

const storagePath = path.resolve(process.cwd(), 'storage.json');

export const storageUtils = {
    setNestedValue: (obj: Record<string, any>, keys: string[], value: any, saveStorage: () => void) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((acc, key) => acc[key] = acc[key] || {}, obj);
        lastObj[lastKey] = value;
        saveStorage();
    },

    getNestedValue: (obj: Record<string, any>, keys: string[]) => {
        return keys.reduce((acc, key) => (acc && acc[key] !== undefined) ? acc[key] : undefined, obj);
    },

    deleteNestedValue: (obj: Record<string, any>, keys: string[], saveStorage: () => void) => {
        const lastKey = keys.pop() as string;
        const lastObj = keys.reduce((acc, key) => acc[key] = acc[key] || {}, obj);
        delete lastObj[lastKey];
        saveStorage();
    }
};

export const createStorageProxy = (saveStorage: () => void): Record<string, any> => {
    return new Proxy<Record<string, any>>({}, {
        set(target, key, value) {
            target[key as string] = value;
            saveStorage();
            return true;
        },
        deleteProperty(target, key) {
            delete target[key as string];
            saveStorage();
            return true;
        }
    });
};

export const createStorageHandlers = (STORAGE: Record<string, any>, saveStorage: () => void): StorageHandlers => ({
    save: (data) => {
        const keys = [data.extension, data.id, ...data.key.split('.')];
        storageUtils.setNestedValue(STORAGE, keys, data.value, saveStorage);
    },
    load: (data) => {
        const keys = [data.extension, data.id, ...data.key.split('.')];
        return storageUtils.getNestedValue(STORAGE, keys);
    },
    delete: (data) => {
        const keys = [data.extension, data.id, ...data.key.split('.')];
        storageUtils.deleteNestedValue(STORAGE, keys, saveStorage);
    }
});

export const loadStorage = (STORAGE: Record<string, any>) => {
    if (fs.existsSync(storagePath)) {
        const data = fs.readFileSync(storagePath, 'utf8');
        const loadedStorage = JSON.parse(data);
        Object.keys(loadedStorage).forEach(key => {
            STORAGE[key] = loadedStorage[key];
        });
    } else {
        saveStorage(STORAGE);
    }
};

export const saveStorage = (STORAGE: Record<string, any>) => {
    fs.writeFileSync(storagePath, JSON.stringify(STORAGE, null, 4), 'utf8');
};
