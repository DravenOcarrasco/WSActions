/**
 * Function to create a module context with WebSocket, storage, and custom data capabilities.
 * @param {string|object} nameOrConfig - Either the module name as a string or a configuration object
 * @param {string} [nameOrConfig.name] - The name of the module when passing an object
 * @param {string} [nameOrConfig.id] - The ID for the module when passing an object (defaults to "ALL")
 * @param {string} [id="ALL"] - The ID parameter when using individual parameters
 * @returns {object} - The context object with methods for WebSocket, storage, and custom data.
 */
function createModuleContext(nameOrConfig, id = "ALL") {
    // Handle both object and individual parameter cases
    let MODULE_NAME;
    let ID;
    
    if (typeof nameOrConfig === 'object' && nameOrConfig !== null) {
        // Object parameter case
        MODULE_NAME = nameOrConfig.name?.toUpperCase();
        ID = nameOrConfig.id || "ALL";
        
        if (!MODULE_NAME) {
            throw new Error("Module name is required when using object configuration");
        }
    } else {
        // Individual parameters case
        if (typeof nameOrConfig !== 'string') {
            throw new Error("Module name must be a string when using individual parameters");
        }
        MODULE_NAME = nameOrConfig.toUpperCase();
        ID = id;
    }
    // Initialize WebSocket connection using global config, with `id` as a query parameter
    const SOCKET = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}`, {
        secure: false,
        query: { id: ID, moduleName: MODULE_NAME }
    });

    SOCKET.on("connect", () => {
        SOCKET.emit("join", { MODULE_NAME })
    })

    SOCKET.on("reconnect", (attempt) => {
        SOCKET.emit("join", { MODULE_NAME });
    });

    // Default keyboard commands setup (example command)
    const KEYBOARD_COMMANDS = [
        {
            description: "Nothing", // Default description
            keys: [{ key: "control", uppercase: false }] // Default key binding
        }
    ];

    // Custom data object where users can store anything they want
    const PUBLIC = {}

    /**
     * Emit a WebSocket event with the module's name prefix.
     * This function ensures that the event name is formatted as `{MODULE_NAME}.evento`.
     * @param {string} event - The event name (without module prefix).
     * @param {object} data - The data to be sent with the event.
     */
    function ioEmit(event, data) {
        SOCKET.emit(event, data);  // Emit the event via WebSocket
    }

    /**
     * Store data in the module-specific or global storage.
     * @param {string} key - The key for the stored value.
     * @param {any} value - The value to store.
     * @param {boolean} isGlobal - If true, store the data globally (shared across all instances).
     * @returns {Promise<object>} - The result of the storage operation.
     */
    async function setStorage(key, value, isGlobal = false) {
        return new Promise((resolve) => {
            // Define the identifier, using "GLOBAL" for global storage
            const identifier = isGlobal ? 'GLOBAL' : window.WSACTION.config.identifier;

            // Timeout if the storage operation takes longer than 10 seconds
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: The operation took more than 10 seconds.' });
            }, 10000);

            // Event listener for storage result
            SOCKET.on(`storage.store.res.${MODULE_NAME}.${identifier}.${key}`, (data) => {
                clearTimeout(timeout); // Clear the timeout once data is received
                resolve(data); // Resolve the promise with the data
            });

            // Emit the storage operation to the server
            SOCKET.emit('storage.store', {
                extension: MODULE_NAME,
                id: identifier, // Use 'GLOBAL' for global storage, otherwise use session identifier
                key,
                value,
                response: `storage.store.res.${MODULE_NAME}.${identifier}.${key}`
            });
        });
    }

    /**
     * Load data from the module-specific or global storage.
     * @param {string} key - The key to load the value for.
     * @param {boolean} isGlobal - If true, load the data from global storage.
     * @returns {Promise<object>} - The result of the load operation.
     */
    async function getStorage(key, isGlobal = false) {
        return new Promise((resolve) => {
            // Define the identifier, using "GLOBAL" for global storage
            const identifier = isGlobal ? 'GLOBAL' : window.WSACTION.config.identifier;

            // Timeout if the load operation takes longer than 10 seconds
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: The operation took more than 10 seconds.' });
            }, 10000);

            // Event listener for load result
            SOCKET.on(`storage.load.res.${MODULE_NAME}.${identifier}.${key}`, (data) => {
                clearTimeout(timeout); // Clear the timeout once data is received
                resolve(data.success ? data : { success: false, error: 'Error loading storage' }); // Resolve with data or error
            });

            // Emit the load request to the server
            SOCKET.emit('storage.load', {
                extension: MODULE_NAME,
                id: identifier, // Use 'GLOBAL' for global storage, otherwise use session identifier
                key,
                response: `storage.load.res.${MODULE_NAME}.${identifier}.${key}`
            });
        });
    }

    /**
     * Get a variable from storage, creating it if it doesn't exist.
     * @param {string} variableName - The name of the variable to retrieve.
     * @param {any} defaultValue - The default value to store if the variable does not exist.
     * @param {boolean} create - Whether to create the variable if it does not exist.
     * @param {boolean} isGlobal - Whether to store the variable globally.
     * @returns {Promise<any>} - The value of the variable.
     */
    async function getVariable(variableName, defaultValue, create = false, isGlobal = false) {
        // Try to get the value from storage
        const data = await getStorage(variableName, isGlobal);

        // If not found and the create flag is set, store the default value
        if (!data.success && create) {
            await setStorage(variableName, defaultValue, isGlobal);
            return defaultValue;
        }
        // If found, return the value
        else if (data.success) {
            return data.value;
        }
        // Otherwise, return the default value
        else {
            return defaultValue;
        }
    }

    /**
     * Set a variable in storage.
     * @param {string} variableName - The name of the variable to set.
     * @param {any} value - The value to store.
     * @param {boolean} isGlobal - Whether to store the variable globally.
     * @returns {Promise<void>} - Resolves when the variable has been set.
     */
    async function setVariable(variableName, value, isGlobal = false) {
        try {
            // Store the value in storage, either globally or locally
            await setStorage(variableName, value, isGlobal);
        } catch (error) {
            console.error(`Error setting variable '${variableName}':`, error);
        }
    }


    // Initial definition of the menu handler
    var MENU_HANDLE = (options) => { };

    /**
     * Sets the menu handler function.
     * This function allows assigning a custom function to the MENU_HANDLE.
     * 
     * @param {function} handlerFunction - The function to be assigned to MENU_HANDLE.
     */
    function setMenuHandler(handlerFunction) {
        if (typeof handlerFunction === 'function') {
            MENU_HANDLE = handlerFunction;
        } else {
            console.error('Handler needs to be a function.');
        }
    }

    /**
     * Displays the menu with the provided options.
     * 
     * @param {Array} options - The options to display in the menu.
     */
    function showMenu(options) {
        if (MENU_HANDLE && typeof MENU_HANDLE === 'function') {
            MENU_HANDLE(options);
        } else {
            console.log('Menu is shown with options:', options);
        }
    }

    function sendChromeCommand(data) {
        window.postMessage({
            ...data,
            ext_name: name
        }, "*");
    }

    function setCustomData(key, value) {
        PUBLIC[key] = value;
    }

    function getCustomData(key) {
        return PUBLIC[key]
    }

    const CONTEXT = {
        MODULE_NAME,
        SOCKET,
        KEYBOARD_COMMANDS,
        PUBLIC,
        sendChromeCommand,
        ioEmit,
        setStorage,
        getStorage,
        getVariable,
        setVariable,
        showMenu,
        setMenuHandler,
        setCustomData,
        getCustomData
    };

    const register = async (CTXAddons = {}) => {
        let isRegistered = false;
        let retryCount = 0;
        const MAX_RETRIES = 30;
        const RETRY_INTERVAL = 1000; // 1 segundo

        const registerContext = () => {
            if (window.WSACTION?.CONTEXT_MANAGER) {
                window.WSACTION.CONTEXT_MANAGER.addExtension(CONTEXT.MODULE_NAME, {
                    location: window.location,
                    ...CONTEXT,
                    ...CTXAddons
                });
                return true;
            }
            return false;
        };

        const specialKeys = {
            ctrlKey: (event) => event.ctrlKey,
            altKey: (event) => event.altKey,
            shiftKey: (event) => event.shiftKey,
            metaKey: (event) => event.metaKey
        };

        const handleKeyEvent = (command, event) => {
            const allKeysMatch = command.keys.every((key) => {
                if (specialKeys[key.key]) {
                    return specialKeys[key.key](event);
                }

                const normalizedKey = key.case_sensitive ? key.key : key.key.toLowerCase();
                const eventKey = key.case_sensitive ? event.key : event.key.toLowerCase();
                const eventCode = key.case_sensitive ? event.code : event.code.toLowerCase();

                return eventKey === normalizedKey || eventCode === normalizedKey;
            });

            if (allKeysMatch) {
                if (typeof command.function === "function") {
                    event.preventDefault();
                    command.function();
                } else {
                    console.warn(`No function assigned for command: ${command.description}`);
                }
            }
        };

        const setupKeyboardListeners = () => {
            try {
                CONTEXT.KEYBOARD_COMMANDS.forEach(command => {
                    const listener = (event) => handleKeyEvent(command, event);
                    document.addEventListener("keydown", listener);

                    // Armazena o listener para possível remoção futura
                    command._listener = listener;
                });
                return true;
            } catch (error) {
                console.error("Error setting up keyboard listeners:", error);
                return false;
            }
        };

        const tryRegister = async () => {
            if (isRegistered) return true;

            if (registerContext() && setupKeyboardListeners()) {
                isRegistered = true;
                console.log("Successfully registered keyboard commands");
                return true;
            }

            retryCount++;
            if (retryCount >= MAX_RETRIES) {
                console.error("Failed to register keyboard commands after maximum retries");
                return false;
            }

            // Agenda próxima tentativa
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL));
            return tryRegister();
        };

        // Função de limpeza para remover os listeners
        const cleanup = () => {
            if (CONTEXT.KEYBOARD_COMMANDS) {
                CONTEXT.KEYBOARD_COMMANDS.forEach(command => {
                    if (command._listener) {
                        document.removeEventListener("keydown", command._listener);
                        delete command._listener;
                    }
                });
            }
            isRegistered = false;
        };

        try {
            const result = await tryRegister();
            if (!result) {
                cleanup();
                throw new Error("Failed to register keyboard commands");
            }
            return cleanup; // Retorna a função de limpeza
        } catch (error) {
            console.error("Error in register function:", error);
            cleanup();
            throw error;
        }
    };

    CONTEXT.register = register;
    // Return the context object, which includes methods, properties, and the customData storage
    return CONTEXT
}

// Register the function globally on the window object for reuse
window.WSACTION = window.WSACTION || {};
window.WSACTION.createModuleContext = createModuleContext;
