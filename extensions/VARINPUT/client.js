(async function () {
    /**
     * Function to create the context for the module.
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
    
    function detectFramework() {
        // Verifica variáveis globais específicas dos frameworks
    
        // Verifica se Next.js está presente via variável global
        if (typeof window.__NEXT_DATA__ !== 'undefined') {
            return 'Next.js';
        }
    
        // Verifica se Gatsby está presente via variável global
        if (typeof window.___gatsby !== 'undefined') {
            return 'Gatsby';
        }
    
        // Verifica se Nuxt.js está presente via variável global
        if (typeof window.$nuxt !== 'undefined') {
            return 'Nuxt.js';
        }
    
        // Verifica se React está presente via variável global
        if (typeof window.React !== 'undefined') {
            return 'React';
        }
    
        // Se as variáveis globais não forem encontradas, verifica o conteúdo do <head>
        const headContent = document.head.innerHTML;
    
        // Verifica padrões no head para Next.js
        if (headContent.includes('/_next/')) {
            return 'Next.js';
        }
    
        // Verifica padrões no head para Gatsby
        if (headContent.includes('gatsby') || headContent.includes('/static/')) {
            return 'Gatsby';
        }
    
        // Verifica padrões no head para Nuxt.js
        if (headContent.includes('/_nuxt/')) {
            return 'Nuxt.js';
        }
    
        // Verifica presença de React no conteúdo do head (React puro)
        if (headContent.includes('React')) {
            return 'React';
        }
    
        // Retorna vazio se nenhum framework for detectado
        return '';
    }

    

    var FRAMEWORK_NAME = "";
    var __VERIFIED = false;

    const simulateInput = (input, value) => {
        // Verifica se o evento foi disparado programaticamente e evita a recursão infinita
        if (input.getAttribute('data-programmatically-changed') === 'true') {
            return;
        }
        // Verifica se o framework já foi detectado
        if (!__VERIFIED) {
            FRAMEWORK_NAME = detectFramework(); // Detecta o framework uma única vez
            __VERIFIED = true;
        }
        
        const dispatchKeyboardEvent = (eventType, key, inputElement) => {
            const event = new KeyboardEvent(eventType, {
                bubbles: true,
                cancelable: true,
                key: key,
                charCode: key.charCodeAt(0),
                keyCode: key.charCodeAt(0),
                which: key.charCodeAt(0)
            });
            inputElement.dispatchEvent(event);
        };

        input.focus();
        console.log(`NAME: ${FRAMEWORK_NAME}`);
        switch (FRAMEWORK_NAME) {
            case "React":
                const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeValueSetter.call(input, value);
                break;
    
            case "Next.js":
                // Obtém o setter nativo do valor para manipulação direta no React
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            
                // Simula digitação de cada caractere
                for (let i = 0; i < value.length; i++) {
                    const char = value[i];
                    
                    // Dispara eventos de teclado simulando a digitação
                    dispatchKeyboardEvent('keydown', char, input);
                    dispatchKeyboardEvent('keypress', char, input);
            
                    // Atualiza o valor progressivamente usando o setter nativo do React
                    nativeInputValueSetter.call(input, value.slice(0, i + 1));
            
                    
            
                    // Finaliza o ciclo da tecla
                    dispatchKeyboardEvent('keyup', char, input);
                }

                // Dispara o evento de input para refletir as mudanças no React/Next.js
                const inputEvent = new Event('input', 
                    { 
                        bubbles: true, 
                        detail: {
                            ignore: true
                        } 
                    }
                );
                input.dispatchEvent(inputEvent);
                break;
    
            case "Gatsby":
                const gatsbyValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                gatsbyValueSetter.call(input, value);
                break;
    
            case "Nuxt.js":
                input.value = value;
                const vueInputEvent = new Event('input', { bubbles: true });
                input.dispatchEvent(vueInputEvent);
                break;
    
            default:
                input.setAttribute('data-programmatically-changed', 'true');
                input.value = value;
                input.dispatchEvent(new CustomEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    detail: {
                        ignore: true
                    }
                }));
                input.removeAttribute('data-programmatically-changed');
                break;
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
