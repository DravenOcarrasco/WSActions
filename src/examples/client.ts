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
     *   setVariable: (variableName: string, value: any, isGlobal: boolean) => Promise<void>,
     *   showMenu: (options: Array<object>) => void,
     *   getCustomData: (key: string) => any,
     *   setCustomData: (key: string, value: any) => void,
     *   setMenuHandler: (handlerFunction: function) => void,
     *   ioEmit: (eventName: string, data: object) => void,
     *   register: (CTXAddons?: object) => Promise<void>
     * }} - The context object with methods for WebSocket, storage, and custom data.
    */
    function createContext(moduleName) {
        return window.WSACTION.createModuleContext(moduleName);
    }
    
    const CONTEXT = createContext("${name.toUpperCase()}");
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
        CONTEXT.ioEmit("join", { MODULE_NAME: CONTEXT.MODULE_NAME });
    });

    /**
     * Handles WebSocket reconnection to the server.
     * Re-emits the 'join' event after reconnection.
     */
    SOCKET.on('reconnect', (attempt) => {
        console.log(\`Reconnected to WebSocket server after \${attempt} attempts\`);
        CONTEXT.ioEmit("join", { MODULE_NAME: CONTEXT.MODULE_NAME });
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
    SOCKET.on(\`\$example:event\`, (data) => {
        console.log('Received event:', data);
    });

    // Examples of WebSocket events being emitted:

    // Emit a simple event with a message
    CONTEXT.ioEmit('sendMessage', { message: 'Hello WebSocket!' });

    // Emit an event to update user settings
    CONTEXT.ioEmit('updateSettings', { theme: 'dark', notifications: true });

    // Emit an event to request data from the server
    CONTEXT.ioEmit('requestData', { userId: 12345 });

    // Emit an event to notify about a completed task
    CONTEXT.ioEmit('taskCompleted', { taskId: 7890, status: 'success' });

    /**
     * Register the module context globally and allow for additional properties via CTXAddons.
     */
    await CONTEXT.register();
})();
    `;
}
