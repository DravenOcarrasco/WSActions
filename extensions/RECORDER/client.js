(async function () {
    async function MakeContext(){
        const MODULE_NAME = "RECORDER";
        const SOCKET = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/`, { secure: false });
        const KEYBOARD_COMMANDS = [
            {
                description: "INIT/STOP RECORD",
                keys: [ 
                    {
                        key: "control", 
                        upercase: false
                    },
                    {
                        key: "alt", 
                        upercase: false
                    },
                    {
                        key: "r", 
                        upercase: false
                    },
                ],
            }
        ]


        /**
         * Displays the menu with the provided options.
         * This function is necessary for the injector to open the menu.
         * @param {Array} options - The menu options.
         */
        const showMenu = function (options) {
            console.log('Menu is shown with options:', options);
        }

        const setStorage = async (key, value) => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
                }, 10000);

                SOCKET.on(`storage.store.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });

                SOCKET.emit('storage.store', {
                    extension: MODULE_NAME,
                    id: window.WSACTION.config.identifier,
                    key,
                    value,
                    response: `storage.store.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`
                });
            });
        };

        const getStorage = async (key) => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
                }, 10000);

                SOCKET.on(`storage.load.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`, (data) => {
                    clearTimeout(timeout);
                    if (data.success) {
                        resolve(data);
                    } else {
                        resolve({ success: false, error: 'Erro ao carregar o armazenamento' });
                    }
                });

                SOCKET.emit('storage.load', {
                    extension: MODULE_NAME,
                    id: window.WSACTION.config.identifier,
                    key,
                    response: `storage.load.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`
                });
            });
        };

        const getVariable = async (variableName, defaultValue, create = false) => {
            const data = await getStorage(variableName);
            if (!data.success && create) {
                await setStorage(variableName, defaultValue);
                return defaultValue;
            } else if (data.success) {
                return data.value;
            } else {
                return defaultValue;
            }
        };

        const startRecording = async () => {
            const result = await setStorage('isRecording', true);
            if (result.success) {
                console.log('Recording started');
                if (!document.title.startsWith('🔴 Recording - ')) {
                    document.title = '🔴 Recording - ' + document.title;
                }
            } else {
                console.error('Failed to start recording:', result.error);
            }
        };

        const stopRecording = async () => {
            const result = await setStorage('isRecording', false);
            if (result.success) {
                console.log('Recording stopped');
                document.title = document.title.replace('🔴 Recording - ', '');
                const { value: recordingTitle } = await Swal.fire({
                    title: 'Enter recording title',
                    input: 'text',
                    inputLabel: 'Recording title',
                    inputPlaceholder: 'Enter the name for this recording',
                    showCancelButton: true
                });

                if (recordingTitle) {
                    SOCKET.emit(`${MODULE_NAME}.make:script`, {
                        name: recordingTitle,
                        history: await getVariable("record_temp", {})
                    });
                    await setStorage("record_temp", {});
                } else {
                    console.log('Recording title input was cancelled');
                }
            } else {
                console.error('Failed to stop recording:', result.error);
            }
        };

        const toggleRecording = async () => {
            const isRecording = await getVariable('isRecording', false);
            if (isRecording) {
                await stopRecording();
            } else {
                await startRecording();
            }
        };

        const applyRecordingIconIfRecording = async () => {
            const isRecording = await getVariable('isRecording', false);
            if (isRecording && !document.title.startsWith('🔴 Recording - ')) {
                document.title = '🔴 Recording - ' + document.title;
            }
        };

        SOCKET.on('connect', () => {
            console.log('Connected to WebSocket server');

            SOCKET.on(`${MODULE_NAME}:event`, (data) => {
                console.log('Received event:', data);
            });
        });

        SOCKET.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
        });

        document.addEventListener('keydown', async (event) => {
            if (event.ctrlKey && event.altKey && event.code === 'KeyR') {
                console.log('Control + Alt + R pressed');
                await toggleRecording();
            }
        });

        await applyRecordingIconIfRecording();  // Check and apply recording icon on load
        
        // Função para obter o XPath de um elemento
        function getElementXPath(element) {
            const paths = [];
            for (; element && element.nodeType === Node.ELEMENT_NODE; element = element.parentNode) {
                let index = 0;
                for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                    if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                    if (sibling.nodeName === element.nodeName) ++index;
                }
                const tagName = element.nodeName.toLowerCase();
                const pathIndex = index ? `[${index + 1}]` : '';
                paths.unshift(`${tagName}${pathIndex}`);
            }
            return paths.length ? `/${paths.join('/')}` : null;
        }

        async function captureAction(event) {
            if (await getVariable('isRecording', false)) {
                const element = event.target;
                const tagName = element.tagName;
                const action = event.type;
                const value = element.value;
                const selector = getElementXPath(element);
                let data = {
                    tagName, 
                    action, 
                    value: value || null, 
                    selector,
                    location: window.location.href,
                    timestamp: new Date().toISOString(),
                    additionalInfo: {}
                };

                // Adiciona informações adicionais dependendo do tipo de evento
                if (action === 'scroll') {
                    data.additionalInfo = {
                        scrollX: window.scrollX,
                        scrollY: window.scrollY
                    };
                } else if (action === 'keydown' || action === 'keyup' || action === 'keypress') {
                    data.additionalInfo = {
                        key: event.key,
                        code: event.code,
                        keyCode: event.keyCode
                    };
                } else if (action === 'click' || action === 'dblclick' || action === 'mousedown' || action === 'mouseup') {
                    data.additionalInfo = {
                        button: event.button,
                        clientX: event.clientX,
                        clientY: event.clientY,
                        screenX: event.screenX,
                        screenY: event.screenY
                    };
                }

                console.log(data);
                let last = await getVariable("record_temp", {});
                last[data.timestamp] = data;
                await setStorage("record_temp", last);
            }
        }

        // Lista de eventos a serem capturados
        const eventsToCapture = [
            'click', 'dblclick', 'mousedown', 'mouseup', 'mouseover', 'mouseout', 
            'keydown', 'keyup', 'keypress', 'input', 'change', 'scroll'
        ];

        // Captura todos os eventos listados
        eventsToCapture.forEach(eventType => {
            document.addEventListener(eventType, captureAction, true);
        });

        return {
            MODULE_NAME,
            KEYBOARD_COMMANDS,
            showMenu,
            setStorage,
            getStorage,
            getVariable,
            SOCKET,
        }
    }

    const context = await MakeContext()
    // Registro da extensão no contexto global
    if (window.extensionContext) {
        window.extensionContext.addExtension(context.MODULE_NAME, {
            location: window.location,
            ...context
        });
    }
})();
