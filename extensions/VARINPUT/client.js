(async function () {
    /**
     * Function to create the context for the module.
     * @returns {Promise<object>} - The context object containing module details and methods.
     */
    async function MakeContext() {
        const MODULE_NAME = "VARINPUT";
        const SOCKET = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/`, { secure: false });
        const KEYBOARD_COMMANDS = [
            {
                description: "Register a new Variable",
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
                        key: "v", 
                        upercase: false
                    },
                ],
            },
            {
                description: "List all variables",
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
                        key: "l", 
                        upercase: false
                    },
                ],
            }
        ]
        
        let VAR_VALUES = {};
        let VARIABLES = [] // Carregar lista de variáveis armazenadas
        
        

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

                SOCKET.on(`storage.load.res.${MODULE_NAME}.${window.WSACTION.config.identifier}.${key}`, (data) => {
                    clearTimeout(timeout);
                    if (data.success) {
                        resolve(data);
                    } else {
                        resolve({ success: false, error: 'Error loading storage' });
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
         * Removes a variable from the list.
         * @param {string} variableName - The name of the variable to remove.
         */
        const removeVariable = async (variableName) => {
            VARIABLES = VARIABLES.filter(v => v.name !== variableName);
            await setStorage('VARIABLES', VARIABLES); // Atualiza o armazenamento após a remoção
        };

        /**
         * Function to get the list of variables from storage.
         * @returns {Promise<Array>} - The list of variable objects { name, value }.
         */
        const getVariableList = async () => {
            const storedVariables = await getStorage('VARIABLES');
            return storedVariables.success ? storedVariables.value.filter(v => v.name && v.value) : [];
        };

        VARIABLES = await getVariableList();

        /**
         * Function to show, edit and remove variables
         */
        const showVariableList = () => {
            const variableList = VARIABLES
                .map(({ name, value }, index) => `
                    <div style="margin-bottom: 10px;">
                        <strong>${name}:</strong> ${value}
                        <button onclick="editVariable(${index})" style="margin-left: 10px;">Editar</button>
                        <button onclick="removeVariable(${index})" style="margin-left: 5px;">Remover</button>
                    </div>
                `).join('');

            Swal.fire({
                title: 'Lista de Variáveis',
                html: variableList || '<p>Nenhuma variável cadastrada</p>',
                width: 600,
                padding: '3em',
                showConfirmButton: false,
                background: '#fff',
                backdrop: `
                    rgba(0,0,123,0.4)
                    url("https://sweetalert2.github.io/images/nyan-cat.gif")
                    left top
                    no-repeat
                `
            });
        };

        /**
         * Function to edit a variable
         */
        window.editVariable = async (index) => {
            const variable = VARIABLES[index];
            const { value: formValues } = await Swal.fire({
                title: 'Editar Variável',
                html: `
                    <input id="swal-input1" class="swal2-input" value="${variable.name}" placeholder="Nome da Variável">
                    <input id="swal-input2" class="swal2-input" value="${variable.value}" placeholder="Valor da Variável">
                `,
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
                    await addOrUpdateVariable(varName, varValue);
                    Swal.fire(`Variável ${varName} atualizada!`);
                    VARIABLES[index] = { name: varName, value: varValue }; // Atualiza localmente
                    showVariableList(); // Atualiza a lista
                } else {
                    Swal.fire('Preencha ambos os campos');
                }
            }
        };

        /**
         * Function to remove a variable
         */
        window.removeVariable = async (index) => {
            const variable = VARIABLES[index];
            await removeVariable(variable.name); // Remove da lista e atualiza o armazenamento
            Swal.fire(`Variável ${variable.name} removida!`);
            showVariableList(); // Atualiza a lista após remoção
        };

        /**
         * Function to get a variable from the VARIABLES array.
         * If the variable doesn't exist, it returns the default value.
         * @param {string} variableName - The name of the variable to find.
         * @param {any} defaultValue - The default value if the variable is not found.
         * @returns {any} - The value of the variable or the default value.
         */
        const getVariableFromList = (variableName, defaultValue) => {
            const variable = VARIABLES.find(v => v.name === variableName);
            return variable ? variable.value : defaultValue;
        };

        return {
            MODULE_NAME,
            VAR_VALUES,
            KEYBOARD_COMMANDS,
            getVariableFromList,
            setStorage,
            getStorage,
            getVariable,
            addOrUpdateVariable, // Função para adicionar ou atualizar variáveis
            removeVariable, // Função para remover variáveis
            showVariableList, // Função para listar as variáveis
            SOCKET
        };
    }

    const context = await MakeContext();

    // Set to keep track of inputs that have the event listener
    const inputsWithListener = new Set();

    const simulateInput = (input, value) => {
        input.focus();
        // Adiciona o atributo customizado 'data-programmatically-changed' para detectar externamente
        input.setAttribute('data-programmatically-changed', 'true');

        // Força a mudança direta no valor do input
        try {
            const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeValueSetter.call(input, value);
        } catch {
            input.value = value;
            // Cria um evento de input que o React pode detectar
            const nativeInputEvent = new CustomEvent('input', {
                bubbles: true,
                cancelable: true,
                detail:{
                    ignore: true
                }
            });
        
            // Dispara o evento 'input' para que o React detecte a mudança
            input.dispatchEvent(nativeInputEvent);
        
            // Cria e dispara o evento de 'change' (opcional, mas pode ser necessário dependendo do form)
            // const nativeChangeEvent = new CustomEvent('change', {
            //     bubbles: true,
            //     cancelable: true,
            // });
        
            // input.dispatchEvent(nativeChangeEvent);
        }
    
        
    };

    // Function to observe changes in the DOM
    const observeDOMChanges = () => {
        // Adiciona um único ouvinte de eventos ao body para capturar inputs
        document.body.addEventListener('input', async (event) => {
            const input = event.target;

            // Verifica se o alvo do evento é um input ou textarea
            if (input.tagName.toLowerCase() === 'input' || input.tagName.toLowerCase() === 'textarea') {
                const value = input.value;
                const variablePattern = /{{(.*?)}}/g;
                let match;
                let newValue = value;

                // Substitui os padrões {{variavel}} pelo valor da variável correspondente
                while ((match = variablePattern.exec(value)) !== null) {
                    const variableName = match[1];
                    const variableValue = context.getVariableFromList(variableName, `{{${variableName}}}`);
                    newValue = newValue.replace(`{{${variableName}}}`, variableValue);
                    simulateInput(input, newValue);
                }
                // input.value = value;
            }
        });
    };

    // Function to show the Swal menu for variable management
    const showVariableMenu = async () => {
        const { value: formValues } = await Swal.fire({
            title: 'Criar Variável',
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

    // Function to handle key combinations
    const handleKeyCombination = (event) => {
        //console.log(`Teclas pressionadas: ctrl=${event.ctrlKey}, alt=${event.altKey}, key=${event.key}`);
        if (event.ctrlKey && event.altKey) {
            if (event.key === 'v') {
                showVariableMenu();
            } else if (event.key === 'l') {
                context.showVariableList();
            }
        }
    };

    observeDOMChanges();
    
    // Add the keydown event listener
    document.addEventListener('keydown', handleKeyCombination);

    // Register the extension in the global context
    if (window.extensionContext) {
        window.extensionContext.addExtension(context.MODULE_NAME, {
            location: window.location,
            ...context
        });
    }
    
})();
