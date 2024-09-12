(async function () {
    /**
     * Function to create the context for the module.
     * @returns {Promise<object>} - The context object containing module details and methods.
     */
    async function MakeContext() {
        const MODULE_NAME = "CONNECTION-INFO";
        const SOCKET = io(`http://${window.WSACTION.config.ip}:${window.WSACTION.config.port}/`, { 
            secure: false,
            reconnection: true,  // Ativa a reconexão automática
            reconnectionAttempts: Infinity,
            reconnectionDelay: 3000 // Tenta reconectar a cada 3 segundos
        });

        const KEYBOARD_COMMANDS = []

        let swalInstance;

        // Exibe um modal de "Conectando" ao iniciar a conexão
        swalInstance = Swal.fire({
            title: 'Conectando...',
            text: 'Aguarde enquanto tentamos conectar ao WSActions.',
            icon: 'info',
            allowOutsideClick: false,
            showConfirmButton: false
        });

        SOCKET.on('connect', () => {
            console.log(`${MODULE_NAME} Connected to WebSocket server`);

            // Atualiza o modal para "Conectado"
            Swal.fire({
                title: 'Conectado!',
                text: 'Conexão estabelecida com o WSActions.',
                icon: 'success',
                timer: 2000, // Exibe por 2 segundos antes de fechar
                showConfirmButton: false
            });
        });

        SOCKET.on('disconnect', () => {
            console.log(`${MODULE_NAME} Disconnected from WebSocket server`);

            // Exibe um modal "Desconectado"
            swalInstance = Swal.fire({
                title: 'Sem conexão com WSActions!',
                text: 'Você está sem conexão com o servidor WSActions.',
                icon: 'error',
                allowOutsideClick: false,
                showConfirmButton: false
            });
        });

        SOCKET.on('reconnecting', (attempt) => {
            console.log(`${MODULE_NAME} Reconnecting to WebSocket server, attempt: ${attempt}`);

            // Atualiza o modal para "Reconectando"
            swalInstance = Swal.fire({
                title: 'Reconectando...',
                text: `Tentando reconectar ao WSActions (Tentativa ${attempt})`,
                icon: 'warning',
                allowOutsideClick: false,
                showConfirmButton: false
            });
        });

        SOCKET.on('reconnect', () => {
            console.log(`${MODULE_NAME} Reconnected to WebSocket server`);

            // Atualiza o modal para "Reconectado"
            Swal.fire({
                title: 'Reconectado!',
                text: 'Conexão restabelecida com sucesso ao WSActions.',
                icon: 'success',
                timer: 2000, // Exibe por 2 segundos antes de fechar
                showConfirmButton: false
            });
        });

        return {
            MODULE_NAME,
            KEYBOARD_COMMANDS,
            SOCKET
        };
    }

    const context = await MakeContext();

    // Register the extension in the global context
    if (window.extensionContext) {
        window.extensionContext.addExtension(context.MODULE_NAME, {
            location: window.location,
            ...context
        });
    }
})();
