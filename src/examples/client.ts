/**
 * Function to generate a mount script for a module.
 * @param {string} name - The name of the module.
 * @returns {string} - The generated script as a string.
 */
export default function mount(name: string) {
    return `
(async function () {
    /**
     * Function to create the context for the module.
     * @returns {Promise<object>} - The context object containing module details and methods.
     */
    async function MakeContext() {
        const MODULE_NAME = "${name.toUpperCase()}";
        const socket = io(\`http://127.0.0.1:\${window.injectorPort}/\`, { secure: false });
        const VAR_NAMES = ["variable1", "variable2", "variable3"];

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

                socket.on(\`storage.store.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`, (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });

                socket.emit('storage.store', {
                    extension: MODULE_NAME,
                    id: window.identifier,
                    key,
                    value,
                    response: \`storage.store.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`
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

                socket.on(\`storage.load.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`, (data) => {
                    clearTimeout(timeout);
                    if (data.success) {
                        resolve(data);
                    } else {
                        resolve({ success: false, error: 'Error loading storage' });
                    }
                });

                socket.emit('storage.load', {
                    extension: MODULE_NAME,
                    id: window.identifier,
                    key,
                    response: \`storage.load.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`
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
         * Displays the menu with the provided options.
         * This function is necessary for the injector to open the menu.
         * @param {Array} options - The menu options.
         */
        const showMenu = function (options) {
            console.log('Menu is shown with options:', options);
        };

        socket.on('connect', () => {
            console.log(\`\${MODULE_NAME} Connected to WebSocket server\`);

            socket.on(\`\${MODULE_NAME}:event\`, (data) => {
                console.log('Received event:', data);
            });
        });

        socket.on('disconnect', () => {
            console.log(\`\${MODULE_NAME} Disconnected from WebSocket server\`);
        });

        return {
            MODULE_NAME,
            variableNames,
            setStorage,
            getStorage,
            getVariable,
            showMenu,
            socket
        };
    }

    const context = await MakeContext();

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
    `;
}