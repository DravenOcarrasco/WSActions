/**
 * Function to create a module context with WebSocket, storage, and custom data capabilities.
 * @param {string} name - The name of the module.
 * @returns {object} - The context object with methods for WebSocket, storage, and custom data.
 */
function createModuleContext(name) {
    // The module name in uppercase
    const MODULE_NAME = name.toUpperCase();

    // Initialize WebSocket connection using global config
    const SOCKET = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}`, { secure: false });

    // Default keyboard commands setup (example command)
    const KEYBOARD_COMMANDS = [
        {
            description: "Nothing", // Default description
            keys: [{ key: "control", uppercase: false }] // Default key binding
        }
    ];

    // Custom data object where users can store anything they want
    const customData = {};

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
    var MENU_HANDLE = (options) => {};

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

    /**
     * Get custom data stored by the user.
     * @param {string} key - The key to retrieve custom data for.
     * @returns {any} - The value of the custom data, or undefined if not set.
     */
    function getCustomData(key) {
        return customData[key];
    }

    /**
     * Set custom data by the user.
     * @param {string} key - The key to store custom data under.
     * @param {any} value - The value to store.
     */
    function setCustomData(key, value) {
        customData[key] = value;
    }

    function sendChromeCommand(data){
        window.postMessage({
            ...data,
            ext_name: name
        }, "*");
    }

    // Return the context object, which includes methods, properties, and the customData storage
    return {
        MODULE_NAME,
        SOCKET,
        KEYBOARD_COMMANDS,
        sendChromeCommand,
        setStorage,
        getStorage,
        getVariable,
        setVariable,
        showMenu,
        getCustomData,   // Access custom data
        setCustomData,    // Store custom data
        setMenuHandler
    };
}

// Register the function globally on the window object for reuse
window.WSACTION = window.WSACTION || {};
window.WSACTION.createModuleContext = createModuleContext;
