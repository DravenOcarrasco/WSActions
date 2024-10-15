/**
 * Function to generate a mount script for a module.
 * @param {string} name - The name of the module.
 * @returns {string} - The generated script as a string.
 */
export default function mount(name: string) {
    return `
(async function () {
    /**
     * Function to create a module context with WebSocket, storage, and custom data capabilities.
     * This function returns a context object with methods that allow interaction with WebSocket events, 
     * storage, and custom data management.
     *
     * @param {string} moduleName - The name of the module.
     * @returns {{
     *   MODULE_NAME: string,
     *   SOCKET: object,
     *   KEYBOARD_COMMANDS: Array<object>,
     *   setStorage: (key: string, value: any, isGlobal: boolean) => Promise<object>,
     *   getStorage: (key: string, isGlobal: boolean) => Promise<object>,
     *   getVariable: (variableName: string, defaultValue: any, create: boolean, isGlobal: boolean) => Promise<any>,
     *   setVariable: (variableName: string, value: any, isGlobal: boolean) => Promise<void>,    // Function to set a variable in local or global storage.
     *   showMenu: (options: Array<object>) => void,
     *   getCustomData: (key: string) => any,
     *   setCustomData: (key: string, value: any) => void
     *   setMenuHandler: (handlerFunction: function) => void
     * }} - The context object with methods for WebSocket, storage, and custom data.
    */
    function createContext(moduleName) {
        return window.WSACTION.createModuleContext(moduleName);
    }
    
    const CONTEXT = createContext("${name.toUpperCase()}");
    const SOCKET = CONTEXT.SOCKET;
    CONTEXT.KEYBOARD_COMMANDS = [
        {
            description: "Nothing", // Default description
            keys: [{ key: "control", uppercase: false }] // Default key binding
        }
    ]

    SOCKET.on('connect', () => {
        console.log(\`\${CONTEXT.MODULE_NAME} Connected to WebSocket server\`);

        SOCKET.on(\`\${CONTEXT.MODULE_NAME}:event\`, (data) => {
            console.log('Received event:', data);
        });
    });

    SOCKET.on('disconnect', () => {
        console.log(\`\${CONTEXT.MODULE_NAME} Disconnected from WebSocket server\`);
    });

    // Register the extension in the global context
    if (window.WSACTION.CONTEXT_MANAGER) {
        window.WSACTION.CONTEXT_MANAGER.addExtension(CONTEXT.MODULE_NAME, {
            location: window.location,
            ...CONTEXT
        });   
    }
})();
    `;
}