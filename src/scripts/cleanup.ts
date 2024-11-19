import { removeFile } from '../utils/fileOperations';
import path from 'path';

// Remove o arquivo api.ts antigo pois foi substituído pela nova estrutura em src/server/
const oldApiPath = path.join(__dirname, '..', 'api.ts');
removeFile(oldApiPath);

console.log('Limpeza concluída. A nova estrutura do servidor está em src/server/');
