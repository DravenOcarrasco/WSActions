(async function () {
    /**
     * Function to create the context for the module.
     * @returns {Promise<object>} - The context object containing module details and methods.
     */
    async function MakeContext() {
        const MODULE_NAME = "VARINPUT";
        const socket = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/`, { secure: false });
        let VAR_NAMES = [];
        let VAR_VALUES = {};

        /**
         * Stores a value in the module's storage.
         * @param {string} key - The storage key.
         * @param {any} value - The value to be stored.
         * @returns {Promise<object>} - Result of the storage operation.
         */
        const setStorage = async (key, value) => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, error: 'Timeout: The operation took more than 10 seconds.' });
                }, 10000);

                socket.on(`storage.store.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });

                socket.emit('storage.store', {
                    extension: MODULE_NAME,
                    id: window.WSACTION.config.identifier,
                    key,
                    value,
                    response: `storage.store.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`
                });
            });
        };

        /**
         * Loads a value from the module's storage.
         * @param {string} key - The storage key.
         * @returns {Promise<object>} - Result of the load operation.
         */
        const getStorage = async (key) => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    resolve({ success: false, error: 'Timeout: The operation took more than 10 seconds.' });
                }, 10000);

                socket.on(`storage.load.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`, (data) => {
                    clearTimeout(timeout);
                    if (data.success) {
                        resolve(data);
                    } else {
                        resolve({ success: false, error: 'Error loading storage' });
                    }
                });

                socket.emit('storage.load', {
                    extension: MODULE_NAME,
                    id: window.WSACTION.config.identifier,
                    key,
                    response: `storage.load.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`
                });
            });
        };

        /**
         * Gets the value of a stored variable, with an option to create it if it does not exist.
         * @param {string} variableName - The variable name.
         * @param {any} defaultValue - The default value if the variable does not exist.
         * @param {boolean} create - Whether to create the variable if it does not exist.
         * @returns {Promise<any>} - The value of the variable.
         */
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

        /**
         * Adds a new variable or updates the value if it already exists.
         * Verifica se os nomes e valores não estão vazios.
         * @param {string} variableName - The name of the variable.
         * @param {any} variableValue - The value of the variable.
         */
        const addOrUpdateVariable = async (variableName, variableValue) => {
            if (!variableName || !variableValue) {
                console.log('Nome ou valor da variável está vazio. Ignorando.');
                return;
            }

            // Verifica se a variável já existe na lista
            const existingVariable = VARIABLES.find(v => v.name === variableName);
            if (existingVariable) {
                // Atualiza o valor da variável existente
                existingVariable.value = variableValue;
            } else {
                // Adiciona nova variável com nome e valor
                VARIABLES.push({ name: variableName, value: variableValue });
            }

            // Salva a lista de variáveis no armazenamento
            await setStorage('VARIABLES', VARIABLES);
        };

        /**
         * Function to get the list of variables from storage.
         * @returns {Promise<Array>} - The list of variable objects { name, value }.
         */
        const getVariableList = async () => {
            const storedVariables = await getStorage('VARIABLES');
            return storedVariables.success ? storedVariables.value.filter(v => v.name && v.value) : [];
        };

        let VARIABLES = await getVariableList(); // Carregar lista de variáveis armazenadas

        socket.on('connect', () => {
            console.log(`${MODULE_NAME} Connected to WebSocket server`);

            socket.on(`${MODULE_NAME}:variables`, (data) => {
                VAR_NAMES = Object.keys(data);
                VAR_VALUES = data;
                console.log('Received variable list:', VAR_NAMES);
                console.log('Received variable values:', VAR_VALUES);
                initializeInputValues();
            });

            socket.on(`${MODULE_NAME}:event`, (data) => {
                console.log('Received event:', data);
            });
        });

        socket.on('disconnect', () => {
            console.log(`${MODULE_NAME} Disconnected from WebSocket server`);
        });

        return {
            MODULE_NAME,
            VAR_NAMES,
            VAR_VALUES,
            setStorage,
            getStorage,
            getVariable,
            addOrUpdateVariable, // Função para adicionar ou atualizar variáveis
            socket
        };
    }

    const context = await MakeContext();

    // Set to keep track of inputs that have the event listener
    const inputsWithListener = new Set();

    // Function to handle input changes
    const handleInputChange = async (event) => {
        const input = event.target;
        const value = input.value;

        // Check for variable format {{variable_name}}
        const variablePattern = /{{(.*?)}}/g;
        const match = variablePattern.exec(value);
        if (match) {
            const variableName = match[1];
            const variableValue = await context.getVariable(variableName, "");
            input.value = value.replace(`{{${variableName}}}`, variableValue);
        }

        console.log(`Input changed: ${input.name} = ${input.value}`);
        await context.addOrUpdateVariable(input.name, input.value); // Adiciona ou atualiza a variável
    };

    // Function to observe changes in the DOM
    const observeDOMChanges = () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'subtree') {
                    const inputs = document.querySelectorAll('input');
                    inputs.forEach((input) => {
                        if (!inputsWithListener.has(input)) {
                            input.addEventListener('input', handleInputChange);
                            inputsWithListener.add(input);
                            replaceVariableInInput(input);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    };

    // Initial setup of input listeners
    const initializeInputListeners = () => {
        const inputs = document.querySelectorAll('input');
        inputs.forEach((input) => {
            if (!inputsWithListener.has(input)) {
                input.addEventListener('input', handleInputChange);
                inputsWithListener.add(input);
                replaceVariableInInput(input);
            }
        });
    };

    // Function to replace variables in inputs
    const replaceVariableInInput = async (input) => {
        const value = input.value;
        const variablePattern = /{{(.*?)}}/g;
        let match;
        let newValue = value;

        while ((match = variablePattern.exec(value)) !== null) {
            const variableName = match[1];
            const variableValue = await context.getVariable(variableName, "");
            newValue = newValue.replace(`{{${variableName}}}`, variableValue);
        }

        input.value = newValue;
    };

    // Function to initialize input values with variables
    const initializeInputValues = () => {
        const inputs = document.querySelectorAll('input');
        inputs.forEach((input) => {
            replaceVariableInInput(input);
        });
    };

    // Function to show the Swal menu for variable management
    const showVariableMenu = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Gerenciar Variáveis',
            html:
                '<input id="swal-input1" class="swal2-input" placeholder="Nome da Variável">' +
                '<input id="swal-input2" class="swal2-input" placeholder="Valor da Variável">',
            focusConfirm: false,
            preConfirm: () => {
                return [
                    document.getElementById('swal-input1').value,
                    document.getElementById('swal-input2').value
                ];
            }
        });

        if (formValues) {
            const [varName, varValue] = formValues;
            if (varName && varValue) {
                await context.addOrUpdateVariable(varName, varValue); // Adiciona ou atualiza a variável
                Swal.fire(`Variável ${varName} definida para ${varValue}`);
            } else {
                Swal.fire('Preencha ambos os campos');
            }
        }
    };

    // Function to show the list of variables
    const showVariableList = () => {
        const variableList = VARIABLES
            .map(({ name, value }) => `<p><strong>${name}:</strong> ${value}</p>`)
            .join('');

        Swal.fire({
            title: 'Lista de Variáveis',
            html: variableList || '<p>Nenhuma variável cadastrada</p>',
            width: 600,
            padding: '3em',
            background: '#fff',
            backdrop: `
                rgba(0,0,123,0.4)
                url("https://sweetalert2.github.io/images/nyan-cat.gif")
                left top
                no-repeat
            `
        });
    };

    // Function to handle key combinations
    const handleKeyCombination = (event) => {
        if (event.ctrlKey && event.altKey) {
            if (event.key === 'v') {
                showVariableMenu();
            } else if (event.key === 'l') {
                showVariableList();
            }
        }
    };

    // Initialize the input listeners and start observing DOM changes
    initializeInputListeners();
    observeDOMChanges();

    // Add the keydown event listener
    document.addEventListener('keydown', handleKeyCombination);

    // Register the extension in the global context
    if (window.extensionContext) {
        window.extensionContext.addExtension(context.MODULE_NAME, {
            location: window.location,
            ...context
        });

        // Register the extension in the control panel
        if (window.extensionContext.isExtensionLoaded(context.MODULE_NAME)) {
            window.extensionContext.emit('extensionLoaded', context.MODULE_NAME);
        }
    }
})();
