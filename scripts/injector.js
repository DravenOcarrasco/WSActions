(function () {
    'use strict';
    
    let CONTEXTS = {};

    let floatingWindow;
    
    if(!window.WSACTION){
        window.WSACTION = {}
    }

    if (window.WSACTION.CONTEXT_MANAGER) {
        return;
    }
    
    window.WSACTION.CONTEXT_MANAGER = {
        extensions: {},
        events: {},
        initialized: true,
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
        },

        // Função para aguardar uma extensão ser adicionada
        awaitExtension: function (name) {
            return new Promise((resolve, reject) => {
                // Verifica se a extensão já foi carregada
                if (this.extensions[name]) {
                    resolve(this.extensions[name]);
                } else {
                    // Listener para a extensão
                    const listener = (context) => {
                        console.log(context)
                        if (context.NAME === name) {
                            resolve(context);
                            this.off('extensionLoaded', listener); // Remove o listener após resolver
                        }
                    };
                    // Escuta o evento 'extensionLoaded'
                    this.on('extensionLoaded', listener);
                }
            });
        },
        addExtension: function (name, context) {
            if (this.extensions[name] == undefined) {
                this.extensions[name] = context;
                this.emit('extensionLoaded', context); // Emite evento quando uma extensão é carregada
            }
        },
        getExtension: function (name) {
            return this.extensions[name] || null;
        },
        isExtensionLoaded: function (context) {
            return this.extensions.hasOwnProperty(context.NAME);
        }
    };

    //modo de compatibilidade < 2.7.2
    window.extensionContext = window.WSACTION.CONTEXT_MANAGER

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
        const scriptUrl = `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/ext/${extension.NAME.replaceAll(' ','_')}/client`;
        await addScript(scriptUrl);
    }

    // Função para aguardar até que a config esteja pronta
    async function waitForConfig() {
        return new Promise((resolve, reject) => {
            const checkConfig = () => {
                if (window.WSACTION && window.WSACTION.config && window.WSACTION.config.ip && window.WSACTION.config.port) {
                    resolve();  // Configuração está pronta
                } else {
                    setTimeout(checkConfig, 100);  // Verifica novamente após 100ms
                }
            };
            checkConfig();  // Inicia a verificação
        });
    }

    async function loadLibraries() {
        
        await waitForConfig()

        const libraries = [
            `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/js/jquery-3.6.0.min.js`,
            `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/js/sweetalert2.js`,
            `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/js/socket.io.js`,
            `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/js/ModuleBase.js`,
        ];
        try {
            await Promise.all(libraries.map(addScript));
        } catch (error) {
            console.error('Erro ao carregar as bibliotecas:', error);
        }
    }

    async function loadEnabledExtensions() {
        try {
            const response = await fetch(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/extensions`);
            const data = await response.json();
            const enabledExtensions = data.ENABLED || [];
            if (enabledExtensions.length === 0) {
                console.log('Nenhuma extensão habilitada encontrada.');
                return;
            }
            await Promise.all(enabledExtensions.map(extension => loadExtension(extension)));
        } catch (error) {}
    }

    function registerExtension(name) {
        const list = document.getElementById('extensions-list');
        const listItem = document.createElement('li');
        listItem.style.display = 'flex';
        listItem.style.alignItems = 'center';
        listItem.style.marginBottom = '10px';
        listItem.style.fontWeight = 'bold'; // Texto mais grosso
        listItem.style.color = '#333'; // Cor do texto

        const iconUrl = `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/ext/${name}/icon`;
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

                // Adicionar listener de clique para exibir os comandos da extensão
                listItem.addEventListener('click', function () {
                    showExtensionCommands(name);
                });
            })
            .catch(error => {
                console.error(`Erro ao carregar o ícone da extensão ${name}:`, error);
            });
    }

    function showExtensionCommands(extensionName) {
        const extensionContext = CONTEXTS[extensionName];
        if (extensionContext) {
            const commandsList = extensionContext.KEYBOARD_COMMANDS || [];
            const commandsHTML = commandsList
                .map(command => `
                    <div style="margin-bottom: 10px;">
                        <strong>${command.description}:</strong> ${command.keys.map(k => k.key).join(' + ')}
                    </div>
                `)
                .join('');

            Swal.fire({
                title: `Comandos da Extensão: ${extensionName}`,
                html: commandsHTML || '<p>Sem comandos disponíveis</p>',
                width: 600,
                padding: '3em',
                background: '#fff',
                confirmButtonText: 'Fechar'
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: `Comandos não encontrados para a extensão ${extensionName}`,
                confirmButtonText: 'Ok'
            });
        }
    }

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
        floatingWindow.style.borderRadius = '10px';
        floatingWindow.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
        floatingWindow.style.overflowY = 'scroll';
        floatingWindow.style.zIndex = '10000';
        floatingWindow.style.display = 'none'; // Inicialmente escondido

        const header = document.createElement('div');
        header.style.padding = '10px';
        header.style.backgroundColor = '#f1f1f1';
        header.style.borderBottom = '1px solid black';
        header.textContent = 'Extensões Carregadas';
        header.style.fontWeight = 'bold';
        header.style.color = '#333';

        const list = document.createElement('ul');
        list.id = 'extensions-list';
        list.style.listStyleType = 'none';
        list.style.padding = '10px';
        list.style.margin = '0';

        floatingWindow.appendChild(header);
        floatingWindow.appendChild(list);
        document.body.appendChild(floatingWindow);
    }

    function toggleFloatingWindow() {
        if (floatingWindow.style.display === 'none') {
            floatingWindow.style.display = 'block';
        } else {
            floatingWindow.style.display = 'none';
        }
    }

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey && event.altKey && event.key === 'p') {
            toggleFloatingWindow();
        }
    });

    window.WSACTION.CONTEXT_MANAGER.on('extensionLoaded', function (context) {
        CONTEXTS[context.MODULE_NAME] = context;
        registerExtension(context.MODULE_NAME);
    });

    document.addEventListener('DOMContentLoaded', async function() {
        createFloatingWindow();
        await loadLibraries();
        await loadEnabledExtensions();
    });

    createFloatingWindow();
    loadLibraries().then(loadEnabledExtensions);
})();
