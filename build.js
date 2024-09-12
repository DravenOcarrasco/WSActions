const { compile } = require('nexe');
const path = require('path');
const fs = require('fs');

// Caminhos de entrada e saída
const inputFile = path.join(__dirname, 'src', 'index.ts');
const outputFile = path.join(__dirname, 'dist', 'WSActions.exe');
const iconFile = path.join(__dirname, 'assets', 'icon.ico');

// Verifica se o ícone existe
if (!fs.existsSync(iconFile)) {
    console.error('O arquivo de ícone não foi encontrado:', iconFile);
    process.exit(1);
}

// Cria a pasta de saída, se não existir
if (!fs.existsSync(path.dirname(outputFile))) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true });
}

(async () => {
    try {
        await compile({
            input: inputFile,                     // Arquivo de entrada
            output: outputFile,                   // Executável de saída
            ico: iconFile,                        // Caminho do ícone
            targets: ['windows-x64-14.17.0'],     // Alvo da compilação
            build: true,                          // Necessário para compilar com patches
            resources: ['./assets/*'],            // Recursos adicionais (se houver)
            rc: {                                 // Informações de metadados
                CompanyName: '',
                FileDescription: 'WSActions',
                ProductName: 'WSActions'
            }
        });
        console.log('Build concluído com sucesso!');
    } catch (error) {
        console.error('Erro ao compilar:', error);
    }
})();
