import crypto from 'crypto';
import os from 'os';
import { execSync } from 'child_process';

// Chave secreta para criptografia (use um valor mais seguro em produção e tenha certeza que ela tem 32 bytes)
const IV_LENGTH = 16; // Tamanho do vetor de inicialização (IV)

class Encripty {
    private secretKey: Buffer;

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
        return iv.toString('hex') + ':' + encrypted.toString('hex'); // Retorna IV e o texto encriptado
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

// Função para obter o endereço MAC
function getMacAddress(): string {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName of Object.keys(networkInterfaces)) {
        const interfaces = networkInterfaces[interfaceName];
        if (interfaces) {
            for (const net of interfaces) {
                if (net.mac !== '00:00:00:00:00:00' && !net.internal) {
                    return net.mac;
                }
            }
        }
    }
    return '00:00:00:00:00:00';
}

// Função para obter o nome do host
function getHostName(): string {
    return os.hostname();
}

// Função para obter a versão do sistema operacional
function getOSVersion(): string {
    return `${os.type()} ${os.release()}`;
}

// Função para obter o ID do disco (ou número de série) no Windows/Linux
function getDiskSerial(): string {
    try {
        if (process.platform === 'win32') {
            const output = execSync('wmic diskdrive get SerialNumber').toString();
            return output.split('\n')[1].trim(); // Pega o número de série do primeiro disco
        }
        if (process.platform === 'linux' || process.platform === 'darwin') {
            const output = execSync('cat /sys/class/dmi/id/product_uuid').toString().trim();
            return output;
        }
    } catch (err) {
        console.error('Erro ao obter o número de série do disco:', err);
    }
    return 'unknown';
}

// Função para gerar uma chave única com base nas informações do sistema
function generateUniqueKey(): string {
    const macAddress = getMacAddress();
    const hostName = getHostName();
    const osVersion = getOSVersion();
    const diskSerial = getDiskSerial();

    // Combine todas as informações
    const systemInfo = `${macAddress}-${hostName}-${osVersion}-${diskSerial}`;

    // Gerar um hash SHA-256 da combinação das informações
    const hash = crypto.createHash('sha256');
    hash.update(systemInfo);
    return hash.digest('hex').substring(0, 32); // Retorna os primeiros 32 caracteres para uma chave de 32 bytes
}

export { Encripty, generateUniqueKey };
