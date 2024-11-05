/**
 * Function to generate a mount script for a module.
 * @param {string} name - The name of the module.
 * @returns {string} - The generated script as a string.
 */
export default function mount(name: string) {
    return `
(async function (
    EXTENSION_ID,
    SHARED_CONTEXT
) {
    /**
     * Function to create a module context with WebSocket, storage, and custom data capabilities.
     * This function returns a context object with methods that allow interaction with WebSocket events, 
     * storage, and custom data management.
     *
     * @param {string} moduleName - The name of the module.
     * @param {string} EXTENSION_ID - ID
     * @returns {{
     *   MODULE_NAME: string,
     *   SOCKET: object,
     *   PUBLIC: Object,
     *   KEYBOARD_COMMANDS: Array<object>,
     *   setStorage: (key: string, value: any, isGlobal: boolean) => Promise<object>,
     *   getStorage: (key: string, isGlobal: boolean) => Promise<object>,
     *   getVariable: (variableName: string, defaultValue: any, create: boolean, isGlobal: boolean) => Promise<any>,
     *   setVariable: (variableName: string, value: any, isGlobal: boolean) => Promise<void>,
     *   showMenu: (options: Array<object>) => void,
     *   setMenuHandler: (handlerFunction: function) => void,
     *   ioEmit: (eventName: string, data: object) => void,
     *   register: (CTXAddons?: object) => Promise<void>
     * }} - The context object with methods for WebSocket, storage, and custom data.
    */
    function createContext(moduleName, EXTENSION_ID) {
        return window.WSACTION.createModuleContext(moduleName, EXTENSION_ID);
    }
    console.log(EXTENSION_ID)
    const CONTEXT = createContext("${name.toUpperCase()}", EXTENSION_ID);
    const SOCKET = CONTEXT.SOCKET;

    /**
     * Define keyboard commands for the module.
     */
    CONTEXT.KEYBOARD_COMMANDS = [
        {
            description: "Nothing", // Default description
            keys: [{ key: "control", uppercase: false }] // Default key binding
        }
    ];

    /**
     * Handles WebSocket connection to the server.
     */
    SOCKET.on('connect', () => {
        console.log(\`\${CONTEXT.MODULE_NAME} Connected to WebSocket server\`);
    });

    /**
     * Handles WebSocket reconnection to the server.
     */
    SOCKET.on('reconnect', (attempt) => {
        console.log(\`Reconnected to WebSocket server after \${attempt} attempts\`);
    });

    /**
     * Handles WebSocket disconnection from the server.
     */
    SOCKET.on('disconnect', () => {
        console.log(\`\${CONTEXT.MODULE_NAME} Disconnected from WebSocket server\`);
    });

    /**
     * Example event handler for receiving events from the WebSocket server.
     */
    SOCKET.on(\`message\`, (data) => {
        console.log('Received event:', data);
    });

    // Emit a simple event with a message
    CONTEXT.ioEmit('sendMessage', { message: 'Hello WebSocket!' });

    /**
     * Register the module context globally and allow for additional properties via CTXAddons.
     */
    await CONTEXT.register();
})(EXTENSION_ID, SHARED_CONTEXT);
    `;
}
