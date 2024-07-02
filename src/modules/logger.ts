// src/modules/logger.ts
import winston from 'winston';
import fs from 'fs';
import path from 'path';

// Cria o diretório de logs se não existir
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// Configuração do logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'application.log') }),
        new winston.transports.Console()
    ]
});

export default logger;
