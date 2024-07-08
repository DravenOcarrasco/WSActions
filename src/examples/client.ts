export default function mount(name:string){
    return `
(async function () {
    const MODULE_NAME = "${name.toUpperCase()}";
    const socket = io('http://127.0.0.1:9514/', { secure: true });

    const setStorage = async (key, value) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
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

    const getStorage = async (key) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
            }, 10000);

            socket.on(\`storage.load.res.\${MODULE_NAME}.\${window.identifier}.\${key}\`, (data) => {
                clearTimeout(timeout);
                if (data.success) {
                    resolve(data);
                } else {
                    resolve({ success: false, error: 'Erro ao carregar o armazenamento' });
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

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');

        socket.on(\`\${MODULE_NAME}:event\`, (data) => {
            console.log('Received event:', data);
        });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });

    if (window.extensionContext) {
        window.extensionContext.addExtension(MODULE_NAME, {
            location: window.location
            // Adicione aqui qualquer funcionalidade ou dados que deseja expor ao contexto
        });

        // Registro da extensão no painel de controle
        if (window.extensionContext.isExtensionLoaded(MODULE_NAME)) {
            window.extensionContext.emit('extensionLoaded', MODULE_NAME);
        }
    }
})();
    `;
}