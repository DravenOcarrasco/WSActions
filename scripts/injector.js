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
    let devTools = {
        console: [],
        network: [],
        performance: {
            marks: {},
            measures: {}
        }
    };

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

        // Função para aguardar uma extensão ser adicionada com timeout e loop de verificação
        awaitExtension(name, timeout = 5000) {
            return new Promise((resolve, reject) => {
                if (this.extensions[name]) {
                    return resolve(this.extensions[name]);
                }

                const timeoutId = setTimeout(() => {
                    clearInterval(checkInterval);
                    this.off('extensionLoaded', listener);
                    reject(new Error(`Timeout: A extensão "${name}" não foi carregada dentro do tempo limite de ${timeout}ms.`));
                }, timeout);

                const listener = (context) => {
                    if (context.NAME === name) {
                        clearTimeout(timeoutId);
                        clearInterval(checkInterval);
                        resolve(context);
                        this.off('extensionLoaded', listener);
                    }
                };

                this.on('extensionLoaded', listener);

                const checkInterval = setInterval(() => {
                    if (this.extensions[name]) {
                        clearTimeout(timeoutId);
                        clearInterval(checkInterval);
                        resolve(this.extensions[name]);
                        this.off('extensionLoaded', listener);
                    }
                }, 100);
            });
        },

        addExtension(name, context) {
            if (!this.extensions[name]) {
                this.extensions[name] = context;
                this.emit('extensionLoaded', context);
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

    // Interceptar console logs
    const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
    };

    ['log', 'error', 'warn', 'info'].forEach(method => {
        console[method] = (...args) => {
            devTools.console.push({
                type: method,
                message: args.map(arg => 
                    typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
                ).join(' '),
                timestamp: new Date().toISOString()
            });
            if (devTools.console.length > 1000) devTools.console.shift();
            originalConsole[method].apply(console, args);
        };
    });

    // Interceptar requisições de rede
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const startTime = performance.now();
        const request = {
            url: args[0],
            method: args[1]?.method || 'GET',
            timestamp: new Date().toISOString()
        };

        try {
            const response = await originalFetch(...args);
            const duration = performance.now() - startTime;
            devTools.network.push({
                ...request,
                status: response.status,
                duration,
                success: true
            });
            return response;
        } catch (error) {
            const duration = performance.now() - startTime;
            devTools.network.push({
                ...request,
                error: error.message,
                duration,
                success: false
            });
            throw error;
        }
    };

    // Performance monitoring
    const originalMark = performance.mark;
    performance.mark = (name) => {
        devTools.performance.marks[name] = performance.now();
        return originalMark.call(performance, name);
    };

    const originalMeasure = performance.measure;
    performance.measure = (name, startMark, endMark) => {
        const result = originalMeasure.call(performance, name, startMark, endMark);
        devTools.performance.measures[name] = {
            duration: result.duration,
            startTime: result.startTime,
            startMark,
            endMark
        };
        return result;
    };

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

    const loadExtension = async (extension) => {
        const scriptUrl = `http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/ext/${encodeURIComponent(extension.NAME)}/client`;
        await addScript(scriptUrl);
    };

    const waitForConfig = () => {
        return new Promise((resolve) => {
            const checkConfig = () => {
                if (window.WSACTION && window.WSACTION.config && window.WSACTION.config.ip && window.WSACTION.config.port) {
                    resolve();
                } else {
                    setTimeout(checkConfig, 100);
                }
            };
            checkConfig();
        });
    };

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
    
    const createDevToolsPanel = () => {
        const panel = document.createElement('div');
        panel.style.padding = '10px';
        panel.style.height = 'calc(100% - 40px)';
        panel.style.overflow = 'auto';
        panel.style.backgroundColor = '#ffffff';
        panel.style.color = '#000000';

        const tabs = document.createElement('div');
        tabs.style.borderBottom = '1px solid #ccc';
        tabs.style.marginBottom = '10px';
        tabs.style.backgroundColor = '#ffffff';

        const tabNames = ['Console', 'Network', 'Performance', 'Inspector'];
        let activeTab = 'Console';

        tabNames.forEach(tabName => {
            const tab = document.createElement('button');
            tab.textContent = tabName;
            Object.assign(tab.style, {
                padding: '8px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#000000',
                borderBottom: tabName === activeTab ? '2px solid #000000' : 'none',
                backgroundColor: tabName === activeTab ? '#f0f0f0' : 'transparent',
                margin: '0 2px',
                borderRadius: '4px 4px 0 0'
            });

            tab.addEventListener('mouseover', () => {
                if (activeTab !== tabName) {
                    tab.style.backgroundColor = '#f8f8f8';
                }
            });

            tab.addEventListener('mouseout', () => {
                if (activeTab !== tabName) {
                    tab.style.backgroundColor = 'transparent';
                }
            });

            tab.addEventListener('click', () => {
                activeTab = tabName;
                Array.from(tabs.children).forEach(t => {
                    t.style.borderBottom = t === tab ? '2px solid #000000' : 'none';
                    t.style.backgroundColor = t === tab ? '#f0f0f0' : 'transparent';
                });
                updateContent();
            });

            tabs.appendChild(tab);
        });

        const content = document.createElement('div');
        content.style.height = 'calc(100% - 40px)';
        content.style.overflow = 'auto';
        content.style.backgroundColor = '#ffffff';
        content.style.color = '#000000';

        const updateContent = () => {
            content.innerHTML = '';
            switch (activeTab) {
                case 'Console':
                    content.appendChild(createConsoleView());
                    break;
                case 'Network':
                    content.appendChild(createNetworkView());
                    break;
                case 'Performance':
                    content.appendChild(createPerformanceView());
                    break;
                case 'Inspector':
                    content.appendChild(createInspectorView());
                    break;
            }
        };

        panel.appendChild(tabs);
        panel.appendChild(content);

        setInterval(updateContent, 1000);

        return panel;
    };

    const createConsoleView = () => {
        const container = document.createElement('div');
        container.style.fontFamily = 'monospace';

        devTools.console.forEach(log => {
            const entry = document.createElement('div');
            entry.style.padding = '4px';
            entry.style.borderBottom = '1px solid #eee';
            entry.style.color = {
                log: '#333',
                error: '#dc3545',
                warn: '#ffc107',
                info: '#17a2b8'
            }[log.type];

            const time = document.createElement('span');
            time.textContent = new Date(log.timestamp).toLocaleTimeString();
            time.style.marginRight = '10px';
            time.style.color = '#666';

            const message = document.createElement('span');
            message.textContent = log.message;

            entry.appendChild(time);
            entry.appendChild(message);
            container.appendChild(entry);
        });

        return container;
    };

    const createNetworkView = () => {
        const container = document.createElement('div');

        devTools.network.forEach(request => {
            const entry = document.createElement('div');
            entry.style.padding = '8px';
            entry.style.borderBottom = '1px solid #eee';
            entry.style.display = 'flex';
            entry.style.justifyContent = 'space-between';
            entry.style.alignItems = 'center';

            const info = document.createElement('div');
            info.innerHTML = `
                <div style="font-weight: bold;">${request.method} ${request.url}</div>
                <div style="color: ${request.success ? '#28a745' : '#dc3545'}">
                    ${request.success ? `Status: ${request.status}` : `Error: ${request.error}`}
                </div>
                <div style="color: #666">${request.duration.toFixed(2)}ms</div>
            `;

            entry.appendChild(info);
            container.appendChild(entry);
        });

        return container;
    };

    const createPerformanceView = () => {
        const container = document.createElement('div');

        // Marks
        const marksSection = document.createElement('div');
        marksSection.innerHTML = '<h3>Performance Marks</h3>';
        Object.entries(devTools.performance.marks).forEach(([name, time]) => {
            const entry = document.createElement('div');
            entry.style.padding = '4px';
            entry.textContent = `${name}: ${time.toFixed(2)}ms`;
            marksSection.appendChild(entry);
        });

        // Measures
        const measuresSection = document.createElement('div');
        measuresSection.innerHTML = '<h3>Performance Measures</h3>';
        Object.entries(devTools.performance.measures).forEach(([name, data]) => {
            const entry = document.createElement('div');
            entry.style.padding = '4px';
            entry.innerHTML = `
                ${name}:<br>
                Duration: ${data.duration.toFixed(2)}ms<br>
                Start: ${data.startMark} (${data.startTime.toFixed(2)}ms)
            `;
            measuresSection.appendChild(entry);
        });

        container.appendChild(marksSection);
        container.appendChild(measuresSection);
        return container;
    };

    const createInspectorView = () => {
        const container = document.createElement('div');
        
        const startInspecting = document.createElement('button');
        startInspecting.textContent = 'Start Element Inspector';
        startInspecting.style.padding = '8px 16px';
        startInspecting.style.margin = '10px';
        startInspecting.style.backgroundColor = '#007BFF';
        startInspecting.style.color = '#fff';
        startInspecting.style.border = 'none';
        startInspecting.style.borderRadius = '4px';
        startInspecting.style.cursor = 'pointer';

        let isInspecting = false;
        let highlightBox = null;

        startInspecting.addEventListener('click', () => {
            isInspecting = !isInspecting;
            startInspecting.textContent = isInspecting ? 'Stop Inspecting' : 'Start Element Inspector';
            startInspecting.style.backgroundColor = isInspecting ? '#dc3545' : '#007BFF';

            if (isInspecting) {
                highlightBox = document.createElement('div');
                highlightBox.style.position = 'fixed';
                highlightBox.style.border = '2px solid #007BFF';
                highlightBox.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
                highlightBox.style.pointerEvents = 'none';
                highlightBox.style.zIndex = '10000';
                document.body.appendChild(highlightBox);

                document.addEventListener('mousemove', highlightElement);
                document.addEventListener('click', inspectElement);
            } else {
                document.removeEventListener('mousemove', highlightElement);
                document.removeEventListener('click', inspectElement);
                if (highlightBox) {
                    highlightBox.remove();
                    highlightBox = null;
                }
            }
        });

        const highlightElement = (e) => {
            if (!isInspecting) return;
            const element = document.elementFromPoint(e.clientX, e.clientY);
            if (element && element !== highlightBox) {
                const rect = element.getBoundingClientRect();
                Object.assign(highlightBox.style, {
                    top: rect.top + 'px',
                    left: rect.left + 'px',
                    width: rect.width + 'px',
                    height: rect.height + 'px'
                });
            }
        };

        const inspectElement = (e) => {
            if (!isInspecting) return;
            e.preventDefault();
            const element = document.elementFromPoint(e.clientX, e.clientY);
            if (element && element !== highlightBox) {
                console.log('Inspected Element:', {
                    tagName: element.tagName,
                    id: element.id,
                    className: element.className,
                    attributes: Array.from(element.attributes).map(attr => ({
                        name: attr.name,
                        value: attr.value
                    })),
                    computedStyle: window.getComputedStyle(element)
                });
            }
        };

        container.appendChild(startInspecting);
        return container;
    };

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
                    e.stopPropagation();
                    showExtensionCommands(name);
                });

                listItem.appendChild(icon);
                listItem.appendChild(text);
                listItem.appendChild(infoButton);
                list.appendChild(listItem);

                listItem.addEventListener('click', () => {
                    showExtensionCommands(name);
                });
            })
            .catch(error => {
                console.error(`❌ Erro ao carregar o ícone da extensão ${name}:`, error);
            });
    };
    
    const showExtensionCommands = (extensionName) => {
        const extensionContext = CONTEXTS[extensionName];
        if (extensionContext) {
            const commandsList = extensionContext.KEYBOARD_COMMANDS || [];
            const commandsHTML = commandsList
                .map((command, index) => `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; padding: 8px; border-radius: 5px; background-color: #f8f9fa;">
                        <div style="flex-grow: 1;">
                            <strong>${command.description}:</strong> ${command.keys.map(k => `<kbd style="background-color: #e9ecef; padding: 2px 5px; border-radius: 3px; margin: 0 2px;">${k.key}</kbd>`).join(' + ')}
                        </div>
                        <button onclick="window.executeCommand_${extensionName}_${index}()" 
                                style="margin-left: 10px; padding: 5px 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; transition: background-color 0.2s;">
                            Executar
                        </button>
                    </div>
                `)
                .join('');

            commandsList.forEach((command, index) => {
                window[`executeCommand_${extensionName}_${index}`] = () => {
                    try {
                        command.function.call(extensionContext);
                    } catch (error) {
                        console.error('Erro ao executar comando:', error);
                    }
                };
            });

            // Add custom styles to ensure Swal appears above DevTools
            const style = document.createElement('style');
            style.textContent = `
                .swal2-container {
                    z-index: 20000 !important;
                }
                .swal2-popup {
                    z-index: 20001 !important;
                }
                .custom-swal-modal {
                    position: relative;
                    z-index: 20001 !important;
                }
            `;
            document.head.appendChild(style);

            Swal.fire({
                title: `Comandos da Extensão: ${extensionName}`,
                html: commandsHTML || '<p>Sem comandos disponíveis</p>',
                width: 1200,
                padding: '3em',
                background: '#fff',
                confirmButtonText: 'Fechar',
                customClass: {
                    container: 'custom-swal-modal',
                    popup: 'custom-swal-modal',
                    header: 'custom-swal-modal',
                    title: 'custom-swal-modal',
                    closeButton: 'custom-swal-modal',
                    icon: 'custom-swal-modal',
                    image: 'custom-swal-modal',
                    content: 'custom-swal-modal',
                    input: 'custom-swal-modal',
                    actions: 'custom-swal-modal',
                    confirmButton: 'custom-swal-modal',
                    cancelButton: 'custom-swal-modal',
                    footer: 'custom-swal-modal'
                },
                didRender: () => {
                    const buttons = document.querySelectorAll('.swal2-html-container button');
                    buttons.forEach(button => {
                        button.addEventListener('mouseover', () => {
                            button.style.backgroundColor = '#218838';
                        });
                        button.addEventListener('mouseout', () => {
                            button.style.backgroundColor = '#28a745';
                        });
                    });
                },
                willClose: () => {
                    commandsList.forEach((_, index) => {
                        delete window[`executeCommand_${extensionName}_${index}`];
                    });
                    style.remove();
                }
            });
        } else {
            // Add custom styles for error modal too
            const style = document.createElement('style');
            style.textContent = `
                .swal2-container {
                    z-index: 20000 !important;
                }
                .swal2-popup {
                    z-index: 20001 !important;
                }
                .custom-swal-modal {
                    position: relative;
                    z-index: 20001 !important;
                }
            `;
            document.head.appendChild(style);

            Swal.fire({
                icon: 'error',
                title: 'Erro',
                text: `Comandos não encontrados para a extensão ${extensionName}`,
                confirmButtonText: 'Ok',
                width: 1200,
                customClass: {
                    container: 'custom-swal-modal',
                    popup: 'custom-swal-modal',
                    header: 'custom-swal-modal',
                    title: 'custom-swal-modal',
                    closeButton: 'custom-swal-modal',
                    icon: 'custom-swal-modal',
                    image: 'custom-swal-modal',
                    content: 'custom-swal-modal',
                    input: 'custom-swal-modal',
                    actions: 'custom-swal-modal',
                    confirmButton: 'custom-swal-modal',
                    cancelButton: 'custom-swal-modal',
                    footer: 'custom-swal-modal'
                },
                willClose: () => {
                    style.remove();
                }
            });
        }
    };

    const createFloatingWindow = () => {
        if (document.getElementById('floating-window')) return;

        floatingWindow = document.createElement('div');
        floatingWindow.id = 'floating-window';
        Object.assign(floatingWindow.style, {
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '1200px',
            height: '600px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: '10000',
            display: 'none',
            fontFamily: 'Arial, sans-serif',
            flexDirection: 'column'
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

        const title = document.createElement('span');
        title.textContent = 'WSActions DevTools';
        header.appendChild(title);

        const buttonContainer = document.createElement('div');
        
        const toggleExtensionsBtn = document.createElement('button');
        toggleExtensionsBtn.textContent = 'Extensions';
        Object.assign(toggleExtensionsBtn.style, {
            marginRight: '10px',
            padding: '5px 10px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid white',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer'
        });

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;';
        Object.assign(closeButton.style, {
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
        });

        buttonContainer.appendChild(toggleExtensionsBtn);
        buttonContainer.appendChild(closeButton);
        header.appendChild(buttonContainer);

        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.height = 'calc(100% - 40px)';
        container.style.backgroundColor = '#ffffff';

        const extensionsList = document.createElement('div');
        extensionsList.id = 'extensions-panel';
        Object.assign(extensionsList.style, {
            width: '350px',
            borderRight: '1px solid #ccc',
            display: 'block', // Extensions panel starts visible
            backgroundColor: '#ffffff'
        });

        const list = document.createElement('ul');
        list.id = 'extensions-list';
        Object.assign(list.style, {
            listStyleType: 'none',
            padding: '10px',
            margin: '0',
            color: '#000000'
        });

        const devToolsContainer = document.createElement('div');
        devToolsContainer.style.flex = '1';
        devToolsContainer.style.backgroundColor = '#ffffff';
        devToolsContainer.appendChild(createDevToolsPanel());

        extensionsList.appendChild(list);
        container.appendChild(extensionsList);
        container.appendChild(devToolsContainer);

        closeButton.addEventListener('click', () => {
            floatingWindow.style.display = 'none';
        });

        toggleExtensionsBtn.addEventListener('click', () => {
            const isVisible = extensionsList.style.display === 'block';
            extensionsList.style.display = isVisible ? 'none' : 'block';
            toggleExtensionsBtn.style.backgroundColor = isVisible ? 'transparent' : 'rgba(255, 255, 255, 0.2)';
        });

        floatingWindow.appendChild(header);
        floatingWindow.appendChild(container);
        document.body.appendChild(floatingWindow);

        makeWindowDraggable(floatingWindow, header);
    };

    const makeWindowDraggable = (windowElement, handleElement) => {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handleElement.style.cursor = 'move';

        handleElement.addEventListener('mousedown', (e) => {
            if (e.target === handleElement) {
                isDragging = true;
                offsetX = e.clientX - windowElement.offsetLeft;
                offsetY = e.clientY - windowElement.offsetTop;
                e.preventDefault();
            }
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

    const toggleFloatingWindow = () => {
        if (floatingWindow) {
            floatingWindow.style.display = (floatingWindow.style.display === 'none') ? 'block' : 'none';
        }
    };

    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'p') {
            toggleFloatingWindow();
        }
    });

    window.WSACTION.CONTEXT_MANAGER.on('extensionLoaded', (context) => {
        CONTEXTS[context.MODULE_NAME] = context;
        registerExtension(context.MODULE_NAME);
    });

    createFloatingWindow();
    loadLibraries().then(loadEnabledExtensions);

})();
