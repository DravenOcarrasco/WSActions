# WSAction

**WSAction** é uma ferramenta avançada que permite controle e automação entre vários navegadores simultaneamente, utilizando uma arquitetura mestre-escravo. O sistema facilita preenchimentos automáticos e o controle remoto, oferecendo uma interface para gravação de ações e automação de tarefas repetitivas.

## Funcionalidades
- Controle simultâneo de múltiplos navegadores
- Preenchimento de campos utilizando variáveis
- Controle remoto via navegador mestre
- Gravação e automação de tarefas

## Pré-requisitos
- [Bun](https://bun.sh/) versão 1.1.24 ou superior
- **Compatível apenas com Windows** (por enquanto, devido à criação de atalhos no sistema)

## Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/DravenOcarrasco/WSActions.git
   cd WSActions
   ```

2. Instale as dependências:
   ```bash
   bun install
   ```

3. Execute o projeto em modo desenvolvimento:
   ```bash
   bun run dev
   ```

4. Ou execute o projeto diretamente:
   ```bash
   bun .\src\index.ts server
   ```

5. Para compilar o projeto:
   ```bash
   bun run build
   ```

6. Para criar um binário com `nexe`:
   ```bash
   bun run nexe-build
   ```

7. Após a instalação, execute o script de configuração:
   ```bash
   bun run postinstall
   ```

## Scripts no `package.json`

- `build`: Compila o projeto usando TypeScript.
- `nexe-build`: Cria um binário para Windows utilizando o `nexe`.
- `dev`: Executa o servidor diretamente com TypeScript.
- `start`: Inicia o servidor usando o código compilado.
- `postinstall`: Executa o script de setup após a instalação.

## Instalação da Extensão do Chrome

1. Acesse a pasta `WSActions\ChromeExtension\WSActions`.
2. No Chrome, abra `chrome://extensions/` e ative o **Modo Desenvolvedor**.
3. Clique em "Carregar sem compactação" e selecione a pasta `WSActions\ChromeExtension\WSActions`.
4. A extensão será adicionada ao Chrome.

## Limitações

- **Política de Segurança de Conteúdo (CSP)**: Alguns sites possuem restrições rigorosas de CSP, o que pode impedir que o WSAction injete scripts nesses sites. Em tais casos, algumas funcionalidades podem não funcionar como esperado.
- **Compatibilidade de Navegadores**: A extensão foi projetada para funcionar no Chrome, e seu uso em outros navegadores pode não ser suportado completamente.
- **Compatibilidade de Sistema Operacional**: Por enquanto, o WSAction é compatível apenas com o sistema operacional Windows devido à necessidade de criação de atalhos.

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).