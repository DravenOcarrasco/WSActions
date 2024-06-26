
# WSAction
WSAction é um projeto que utiliza injetores de JavaScript para estender funcionalidades no navegador. Recomendamos o uso do [Tampermonkey](https://www.tampermonkey.net/) para injetar os scripts.

## Pré-requisitos

Certifique-se de que você tem o seguinte instalado:

- [Node.js](https://nodejs.org/) (versão 14 ou superior)
- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- [Tampermonkey](https://www.tampermonkey.net/) (ou outro injetor de JS compatível)

## Instalação do Bun

Para instalar o Bun, execute o seguinte comando em seu terminal:

```sh
curl -fsSL https://bun.sh/install | bash
```

Após a instalação, adicione o Bun ao seu `PATH` executando:

```sh
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

Certifique-se de adicionar essas linhas ao seu arquivo de configuração do shell (`.bashrc`, `.zshrc`, etc.) para que o Bun esteja disponível em novas sessões de terminal.

## Configuração do Projeto

1. Clone este repositório:

```sh
git clone https://github.com/DravenOcarrasco/WSActions.git
cd WSAction
```

2. Instale as dependências do projeto usando Bun:

```sh
bun install
```

## Uso

### Scripts Disponíveis

- `bun run start`: Inicia o servidor de desenvolvimento.
- `bun run build`: Compila o projeto para produção.

Para executar qualquer um desses scripts, use o comando `bun run <script>`.

### Desenvolvimento

Para iniciar o servidor de desenvolvimento, execute:

```sh
bun run start
```

Abra [http://127.0.0.1:9514](http://127.0.0.1:9514) para ver o projeto em execução.

### Compilação

Para compilar o projeto para produção e copiar os arquivos de `src/extension` para `dist`, execute:

```sh
bun run build
```

Os arquivos compilados serão gerados na pasta `dist`.

## Uso do Tampermonkey

1. Instale o [Tampermonkey](https://www.tampermonkey.net/) em seu navegador.

2. Habilite o modo de desenvolvedor no gerenciador de extensões do Chrome:
    - Abra o Chrome e vá para `chrome://extensions/`.
    - Ative a opção "Modo de desenvolvedor" no canto superior direito.

3. Adicione o seguinte script ao Tampermonkey:

```javascript
// ==UserScript==
// @name         WebSocket Client for Tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Connects to a secure WebSocket server and performs actions based on commands received
// @author       Your Name
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Incluindo o script remoto
    const clientScript = document.createElement('script');
    clientScript.src = 'http://127.0.0.1:8080/client.js';
    document.head.appendChild(clientScript);

    clientScript.onload = () => {
        console.log('client.js carregado com sucesso');
    };

    clientScript.onerror = () => {
        console.error('Erro ao carregar client.js');
    };
})();
```

4. Salve e habilite o script no Tampermonkey.

5. Acesse a página [http://127.0.0.1:9514/extensions](http://127.0.0.1:9514/extensions) para permitir o acesso ao HTTPS auto-assinado.

## Contribuição

Sinta-se à vontade para abrir issues e pull requests para melhorias e correções.