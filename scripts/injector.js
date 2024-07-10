(function () {
    'use strict';
    let floatingWindow;
    
    if (window.extensionContext) {
        return
    }

    window.extensionContext = {
        extensions: {},
        events: {},
        initialized: true,
        addExtension: function (name, context) {
            if(this.extensions[name] == undefined){
                this.extensions[name] = context;
                this.emit('extensionLoaded', name); // Emite evento quando uma extensão é carregada
            }
        },
        getExtension: function (name) {
            return this.extensions[name] || null;
        },
        isExtensionLoaded: function (name) {
            return this.extensions.hasOwnProperty(name);
        },
        on: function (event, listener) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(listener);
        },
        off: function (event, listener) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(l => l !== listener);
        },
        emit: function (event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(listener => listener(data));
        }
    };
    // Função para adicionar um script ao documento
    function addScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                resolve();
            };
            script.onerror = () => {
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
        const scriptUrl = `http://127.0.0.1:${window.injectorPort}/ext/${extension.NAME}/client`;
        await addScript(scriptUrl);
    }

    // Carrega as bibliotecas necessárias
    async function loadLibraries() {
        const libraries = [
            `http://127.0.0.1:${window.injectorPort}/js/jquery-3.6.0.min.js`,
            `http://127.0.0.1:${window.injectorPort}/js/sweetalert2.js`,
            `http://127.0.0.1:${window.injectorPort}/js/socket.io.js`,
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
            const response = await fetch(`http://127.0.0.1:${window.injectorPort}/extensions`);
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
                window.open(`http://127.0.0.1:${window.injectorPort}/extensions`, '_blank');
            }, 1000);
        }
    }

    // Função para registrar uma extensão no painel
    function registerExtension(name) {
        const list = document.getElementById('extensions-list');
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '10px';
        listItem.style.fontWeight = 'bold'; // Texto mais grosso
        listItem.style.color = '#333'; // Cor do texto

        const iconUrl = `http://127.0.0.1:${window.injectorPort}/ext/${name}/icon`;
        fetch(iconUrl)
            .then(response => response.text())
            .then(base64Icon => {
                const icon = document.createElement('img');
                icon.src = base64Icon;
                icon.alt = name;
                icon.style.width = '24px';
                icon.style.height = '24px';
                icon.style.marginRight = '10px';

                const text = document.createElement('span');
                text.textContent = name;

                listItem.appendChild(icon);
                listItem.appendChild(text);
                list.appendChild(listItem);
            })
            .catch(error => {
                console.error(`Erro ao carregar o ícone da extensão ${name}:`, error);
            });
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
        floatingWindow.style.borderRadius = '10px'; // Bordas arredondadas
        floatingWindow.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)'; // Sombra
        floatingWindow.style.overflowY = 'scroll';
        floatingWindow.style.zIndex = '10000';
        floatingWindow.style.display = 'none'; // Inicialmente escondido

        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.backgroundColor = '#f1f1f1';
        header.style.borderBottom = '1px solid black';
        header.textContent = 'Extensões Carregadas';
        header.style.fontWeight = 'bold'; // Texto mais grosso
        header.style.color = '#333'; // Cor do texto

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

    // Listener para registrar a extensão quando ela for carregada
    window.extensionContext.on('extensionLoaded', function (name) {
        registerExtension(name);
    });

    // Executa o carregamento das bibliotecas e extensões
    document.addEventListener('DOMContentLoaded', async function() {
        createFloatingWindow();
        await loadLibraries();
        await loadEnabledExtensions();
    });

    createFloatingWindow();
    loadLibraries().then(loadEnabledExtensions);
})();
