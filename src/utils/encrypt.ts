import crypto from 'crypto';
import os from 'os';

// Defina o tamanho do vetor de inicialização (IV)
const IV_LENGTH = 16;

class Encripty {
    private secretKey: Buffer;

    // Construtor que recebe uma chave secreta e verifica seu tamanho
    constructor(secretKey: string) {
        if (secretKey.length !== 32) {
            throw new Error('A chave secreta deve ter exatamente 32 caracteres.');
        }
        this.secretKey = Buffer.from(secretKey);
    }

    // Função para encriptar dados
    encrypt(text: string): string {
        const iv = crypto.randomBytes(IV_LENGTH); // Gera um IV aleatório
        const cipher = crypto.createCipheriv('aes-256-cbc', this.secretKey, iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex'); // Retorna o IV e o texto encriptado
    }

    // Função para decriptar dados
    decrypt(encryptedText: string): string {
        const textParts = encryptedText.split(':');
        const iv = Buffer.from(textParts.shift()!, 'hex'); // Primeiro elemento é o IV
        const encrypted = Buffer.from(textParts.join(':'), 'hex'); // O restante é o texto encriptado
        const decipher = crypto.createDecipheriv('aes-256-cbc', this.secretKey, iv);
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString(); // Retorna o texto original decriptado
    }
}

// Função para obter o nome do host
function getHostName(): string {
    return os.hostname();
}

// Função para obter a versão do sistema operacional
function getOSVersion(): string {
    return `${os.type()} ${os.release()}`;
}

// Função para gerar uma chave única com base em informações estáveis do sistema
function generateUniqueKey(): string {
    const hostName = getHostName();
    const osVersion = getOSVersion();

    // Combine informações do sistema para gerar uma chave única
    const systemInfo = `${hostName}-${osVersion}`;

    // Gerar um hash SHA-256 das informações
    const hash = crypto.createHash('sha256');
    hash.update(systemInfo);
    return hash.digest('hex').substring(0, 32); // Retorna os primeiros 32 caracteres para uma chave de 32 bytes
}

export { Encripty, generateUniqueKey };
