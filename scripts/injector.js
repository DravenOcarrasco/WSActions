(() => {
    'use strict';

    // Certifique-se de que window.WSACTION existe
    if (!window.WSACTION) {
        window.WSACTION = {};
    }

    // Evita múltiplas inicializações
    if (window.WSACTION.CONTEXT_MANAGER) {
        return;
    }

    const CONTEXTS = {};
    let floatingWindow;

    // Define o gerenciador de contexto
    window.WSACTION.CONTEXT_MANAGER = {
        extensions: {},
        events: {},
        initialized: true,

        on(event, listener) {
            if (!this.events[event]) {
                this.events[event] = [];
            }
            this.events[event].push(listener);
        },

        off(event, listener) {
            if (!this.events[event]) return;
            this.events[event] = this.events[event].filter(l => l !== listener);
        },

        emit(event, data) {
            if (!this.events[event]) return;
            this.events[event].forEach(listener => listener(data));
        },

        // Função para aguardar uma extensão ser adicionada
        awaitExtension(name) {
            return new Promise((resolve) => {
                // Verifica se a extensão já foi carregada
                if (this.extensions[name]) {
                    resolve(this.extensions[name]);
                } else {
                    // Listener para a extensão
                    const listener = (context) => {
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

        addExtension(name, context) {
            if (!this.extensions[name]) {
                this.extensions[name] = context;
                this.emit('extensionLoaded', context); // Emite evento quando uma extensão é carregada
            }
        },

        getExtension(name) {
            return this.extensions[name] || null;
        },

        isExtensionLoaded(context) {
            return Object.prototype.hasOwnProperty.call(this.extensions, context.NAME);
        },
    };

    // Modo de compatibilidade para versões < 2.7.2
    window.extensionContext = window.WSACTION.CONTEXT_MANAGER;

    // Função para adicionar um script dinamicamente
    const addScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => {
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao carregar extensão',
                    text: `Não foi possível carregar a extensão do URL: ${src}`,
                    confirmButtonText: 'Ok',
                });
                reject(new Error(`Erro ao carregar ${src}`));
            };
            document.head.appendChild(script);
        });
    };

    // Função para carregar uma extensão
    const loadExtension = async (extension) => {
        const scriptUrl = `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/ext/${encodeURIComponent(extension.NAME)}/client`;
        await addScript(scriptUrl);
    };

    // Função para aguardar até que a configuração esteja pronta
    const waitForConfig = () => {
        return new Promise((resolve) => {
            const checkConfig = () => {
                if (window.WSACTION && window.WSACTION.config && window.WSACTION.config.ip && window.WSACTION.config.port) {
                    resolve(); // Configuração está pronta
                } else {
                    setTimeout(checkConfig, 100); // Verifica novamente após 100ms
                }
            };
            checkConfig();
        });
    };

    // Função para carregar as bibliotecas necessárias
    const loadLibraries = async () => {
        await waitForConfig();

        const { ip, port } = window.WSACTION.config;
        const baseUrl = `http://${ip}:${port}`;

        const libraries = [
            `${baseUrl}/js/jquery-3.6.0.min.js`,
            `${baseUrl}/js/sweetalert2.js`,
            `${baseUrl}/js/socket.io.js`,
            `${baseUrl}/js/ModuleBase.js`,
        ];

        try {
            await Promise.all(libraries.map(addScript));
            console.log('📚 Bibliotecas carregadas com sucesso.');
        } catch (error) {
            console.error('❌ Erro ao carregar as bibliotecas:', error);
        }
    };

    // Função para carregar as extensões habilitadas
    const loadEnabledExtensions = async () => {
        try {
            const { ip, port } = window.WSACTION.config;
            const response = await fetch(`http://${ip}:${port}/extensions`);
            const data = await response.json();
            const enabledExtensions = data.ENABLED || [];

            if (enabledExtensions.length === 0) {
                console.log('ℹ️ Nenhuma extensão habilitada encontrada.');
                return;
            }

            await Promise.all(enabledExtensions.map(loadExtension));
            console.log('🧩 Extensões carregadas com sucesso.');
        } catch (error) {
            console.error('❌ Erro ao carregar extensões habilitadas:', error);
        }
    };

    // Função para registrar uma extensão na janela flutuante
    const registerExtension = (name) => {
        const list = document.getElementById('extensions-list');
        if (!list) return;

        const listItem = document.createElement('li');
        Object.assign(listItem.style, {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '10px',
            fontWeight: 'bold',
            color: '#333',
            cursor: 'pointer',
            padding: '5px',
            borderRadius: '5px',
            transition: 'background-color 0.2s',
        });

        listItem.addEventListener('mouseover', () => {
            listItem.style.backgroundColor = '#f0f0f0';
        });

        listItem.addEventListener('mouseout', () => {
            listItem.style.backgroundColor = 'transparent';
        });

        const iconUrl = `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/ext/${encodeURIComponent(name)}/icon`;
        fetch(iconUrl)
            .then(response => response.text())
            .then(base64Icon => {
                const icon = document.createElement('img');
                Object.assign(icon, {
                    src: base64Icon,
                    alt: name,
                });
                Object.assign(icon.style, {
                    width: '24px',
                    height: '24px',
                    marginRight: '10px',
                    borderRadius: '50%',
                });

                const text = document.createElement('span');
                text.textContent = name;
                Object.assign(text.style, {
                    flexGrow: '1',
                });

                const infoButton = document.createElement('button');
                infoButton.textContent = 'Info';
                Object.assign(infoButton.style, {
                    padding: '5px 10px',
                    border: 'none',
                    backgroundColor: '#007BFF',
                    color: '#fff',
                    borderRadius: '5px',
                    cursor: 'pointer',
                });

                infoButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Impede o evento de clique do pai
                    showExtensionCommands(name);
                });

                listItem.appendChild(icon);
                listItem.appendChild(text);
                listItem.appendChild(infoButton);
                list.appendChild(listItem);

                // Adicionar listener de clique para ativar a extensão ou mostrar mais opções
                listItem.addEventListener('click', () => {
                    // Você pode definir o que acontece quando o item é clicado
                    // Por agora, vamos apenas mostrar os comandos
                    showExtensionCommands(name);
                });
            })
            .catch(error => {
                console.error(`❌ Erro ao carregar o ícone da extensão ${name}:`, error);
            });
    };

    // Função para exibir os comandos da extensão
    const showExtensionCommands = (extensionName) => {
        const extensionContext = CONTEXTS[extensionName];
        if (extensionContext) {
            const commandsList = extensionContext.KEYBOARD_COMMANDS || [];
            const commandsHTML = commandsList
                .map(command => `
                    <div style="margin-bottom: 10px;">
                        <strong>${command.description}:</strong> ${command.keys.map(k => `<kbd>${k.key}</kbd>`).join(' + ')}
                    </div>
                `)
                .join('');

            Swal.fire({
                title: `Comandos da Extensão: ${extensionName}`,
                html: commandsHTML || '<p>Sem comandos disponíveis</p>',
                width: 600,
                padding: '3em',
                background: '#fff',
                confirmButtonText: 'Fechar',
            });
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: `Comandos não encontrados para a extensão ${extensionName}`,
                confirmButtonText: 'Ok',
            });
        }
    };

    // Função para criar a janela flutuante
    const createFloatingWindow = () => {
        if (document.getElementById('floating-window')) return; // Evita duplicação

        floatingWindow = document.createElement('div');
        floatingWindow.id = 'floating-window';
        Object.assign(floatingWindow.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '350px',
            height: '500px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            overflowY: 'auto',
            zIndex: '10000',
            display: 'none', // Inicialmente escondido
            fontFamily: 'Arial, sans-serif',
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '10px',
            backgroundColor: '#007BFF',
            borderBottom: '1px solid #ccc',
            fontWeight: 'bold',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
        });
        header.textContent = 'Extensões Carregadas';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        Object.assign(closeButton.style, {
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
        });
        closeButton.addEventListener('click', () => {
            floatingWindow.style.display = 'none';
        });

        header.appendChild(closeButton);

        const list = document.createElement('ul');
        list.id = 'extensions-list';
        Object.assign(list.style, {
            listStyleType: 'none',
            padding: '10px',
            margin: '0',
        });

        floatingWindow.appendChild(header);
        floatingWindow.appendChild(list);
        document.body.appendChild(floatingWindow);

        // Tornar a janela flutuante arrastável
        makeWindowDraggable(floatingWindow, header);
    };

    // Função para tornar a janela flutuante arrastável
    const makeWindowDraggable = (windowElement, handleElement) => {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handleElement.style.cursor = 'move';

        handleElement.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - windowElement.offsetLeft;
            offsetY = e.clientY - windowElement.offsetTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                windowElement.style.left = `${e.clientX - offsetX}px`;
                windowElement.style.top = `${e.clientY - offsetY}px`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    };

    // Função para alternar a janela flutuante
    const toggleFloatingWindow = () => {
        if (floatingWindow) {
            floatingWindow.style.display = (floatingWindow.style.display === 'none') ? 'block' : 'none';
        }
    };

    // Atalho de teclado para alternar a janela flutuante (Ctrl+Alt+P)
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'p') {
            toggleFloatingWindow();
        }
    });

    // Listener para registrar extensões quando carregadas
    window.WSACTION.CONTEXT_MANAGER.on('extensionLoaded', (context) => {
        CONTEXTS[context.MODULE_NAME] = context;
        registerExtension(context.MODULE_NAME);
    });

    // Inicializa a janela flutuante imediatamente
    createFloatingWindow();

    // Carrega as bibliotecas e extensões imediatamente
    loadLibraries().then(loadEnabledExtensions);

})();
