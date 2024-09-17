const { compile } = require('nexe');
const path = require('path');
const fs = require('fs');

// Caminhos de entrada e saída
const inputFile = path.join(__dirname, 'src', 'index.ts');  // Arquivo principal de entrada
const outputFile = path.join(__dirname, 'dist', 'WSActions.exe');  // Caminho do executável gerado
const iconFile = path.join(__dirname, 'assets', 'icon.ico');  // Caminho do ícone

// Verifica se o arquivo de entrada existe
if (!fs.existsSync(inputFile)) {
    console.error('O arquivo de entrada não foi encontrado:', inputFile);
    process.exit(1);
}

// Verifica se o ícone existe
if (!fs.existsSync(iconFile)) {
    console.error('O arquivo de ícone não foi encontrado:', iconFile);
    process.exit(1);
}

// Cria a pasta de saída, se não existir
if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

// Processo de compilação com nexe
compile({
    input: inputFile,                     // Arquivo principal
    output: outputFile,                   // Caminho para o executável gerado
    ico: iconFile,                        // Ícone do executável
    targets: ['windows-x64-14.15.3'],     // Alvo da compilação (Node.js 14.17.0 para Windows x64)
    resources: [
        './node_modules/puppeteer/.local-chromium/**/*',  // Inclui o Chromium local
        './assets/**/*'  // Inclui todos os arquivos da pasta assets
    ],
    rc: {                                 // Informações de metadados
        CompanyName: 'Sua Empresa',
        FileDescription: 'WSActions - Gerenciador de ações da web',
        ProductName: 'WSActions'
    }
}).then(() => {
    console.log('Build concluída com sucesso!');
}).catch((error) => {
    console.error('Erro ao compilar:', error);
});
