import { existsSync, writeFileSync, readFileSync } from 'fs';
import path from 'path';
import { Encripty, generateUniqueKey } from './encrypt';

const filePath = path.join(process.cwd(), 'identity.bin');
const encripty = new Encripty(generateUniqueKey());

// Função para criar ou carregar o arquivo de identidade
export const createOrLoadIdentityFile = (): { user_id: string | null } => {
    const createIdentity = () => {
        const identity = { user_id: null };
        const encryptedData = encripty.encrypt(JSON.stringify(identity));
        writeFileSync(filePath, encryptedData);
        return identity;
    };

    if (existsSync(filePath)) {
        try {
            const encryptedData = readFileSync(filePath, 'utf8');
            const decryptedData = encripty.decrypt(encryptedData);
            return JSON.parse(decryptedData);
        } catch (error) {
            return createIdentity();
        }
    }

    return createIdentity();
};

// Função para atualizar o user_id no arquivo de identidade
export const updateIdentityFile = (newUserId: string): void => {
    const identity = createOrLoadIdentityFile();
    identity.user_id = newUserId;
    const encryptedData = encripty.encrypt(JSON.stringify(identity));
    writeFileSync(filePath, encryptedData);
};
