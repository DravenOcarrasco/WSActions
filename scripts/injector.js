(function () {
    'use strict';
    let floatingWindow;

    // Função para adicionar um script ao documento
    function addScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.info(`EXT_DONE: ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`Erro ao carregar ${src}`);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao carregar extensão',
                    text: `Não foi possível carregar a extensão do URL: ${src}`,
                    confirmButtonText: 'Ok'
                });
                reject(new Error(`Erro ao carregar ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    async function loadExtension(extension){
        const scriptUrl = `http://127.0.0.1:9514/ext/${extension.NAME}/client`;
        await addScript(scriptUrl);
        addExtensionToList(extension.NAME);
    }

    // Carrega as bibliotecas necessárias
    async function loadLibraries() {
        const libraries = [
            'http://127.0.0.1:9514/js/jquery-3.6.0.min.js',
            'http://127.0.0.1:9514/js/sweetalert2.js',
            'http://127.0.0.1:9514/js/socket.io.js'
        ];

        try {
            await Promise.all(libraries.map(addScript));
            console.info('Todas as bibliotecas foram carregadas com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar as bibliotecas:', error);
        }
    }

    // Função para carregar as extensões habilitadas
    async function loadEnabledExtensions() {
        try {
            const response = await fetch('http://127.0.0.1:9514/extensions');
            const data = await response.json();
            const enabledExtensions = data.ENABLED || [];

            if (enabledExtensions.length === 0) {
                console.log('Nenhuma extensão habilitada encontrada.');
                return;
            }

            // Carrega os scripts das extensões habilitadas
            await Promise.all(enabledExtensions.map(extension => loadExtension(extension)));
        } catch (error) {
            setTimeout(() => {
                window.open('http://127.0.0.1:9514/extensions', '_blank');
            }, 1000);
        }
    }

    // Função para adicionar a extensão à lista de extensões carregadas
    async function addExtensionToList(extensionName) {
        const list = document.getElementById('extensions-list');
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '10px';

        const iconUrl = `http://127.0.0.1:9514/ext/${extensionName}/icon`;
        try {
            const response = await fetch(iconUrl);
            const base64Icon = await response.text();

            const icon = document.createElement('img');
            icon.src = base64Icon;
            icon.alt = extensionName;
            icon.style.width = '24px';
            icon.style.height = '24px';
            icon.style.marginRight = '10px';

            const text = document.createElement('span');
            text.textContent = extensionName;

            listItem.appendChild(icon);
            listItem.appendChild(text);
            list.appendChild(listItem);
        } catch (error) {
            console.error(`Erro ao carregar o ícone da extensão ${extensionName}:`, error);
        }
    }

    // Função para criar a janela flutuante
    function createFloatingWindow() {
        floatingWindow = document.createElement('div');
        floatingWindow.id = 'floating-window';
        floatingWindow.style.position = 'fixed';
        floatingWindow.style.top = '10px';
        floatingWindow.style.right = '10px';
        floatingWindow.style.width = '300px';
        floatingWindow.style.height = '400px';
        floatingWindow.style.backgroundColor = 'white';
        floatingWindow.style.border = '1px solid black';
        floatingWindow.style.overflowY = 'scroll';
        floatingWindow.style.zIndex = '10000';
        floatingWindow.style.display = 'none'; // Inicialmente escondido

        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.backgroundColor = '#f1f1f1';
        header.style.borderBottom = '1px solid black';
        header.textContent = 'Extensões Carregadas';

        const list = document.createElement('ul');
        list.id = 'extensions-list';
        list.style.listStyleType = 'none';
        list.style.padding = '10px';
        list.style.margin = '0';

        floatingWindow.appendChild(header);
        floatingWindow.appendChild(list);
        document.body.appendChild(floatingWindow);
    }

    // Função para mostrar/ocultar a janela flutuante
    function toggleFloatingWindow() {
        if (floatingWindow.style.display === 'none') {
            floatingWindow.style.display = 'block';
        } else {
            floatingWindow.style.display = 'none';
        }
    }

    // Listener para detectar Ctrl + Alt + P
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.altKey && event.key === 'p') {
            toggleFloatingWindow();
        }
    });

    // Executa o carregamento das bibliotecas e extensões
    document.addEventListener('DOMContentLoaded', async function() {
        createFloatingWindow();
        await loadLibraries();
        await loadEnabledExtensions();
    });
})();
