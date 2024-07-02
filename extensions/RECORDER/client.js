(async function () {
    const MODULE_NAME = "RECORDER";
    const socket = io('http://127.0.0.1:9514/', { secure: true });

    const setStorage = async (key, value) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
            }, 10000);

            socket.on(`storage.store.res.${MODULE_NAME}.${window.identifier}.${key}`, (data) => {
                clearTimeout(timeout);
                resolve(data);
            });

            socket.emit('storage.store', {
                extension: MODULE_NAME,
                id: window.identifier,
                key,
                value,
                response: `storage.store.res.${MODULE_NAME}.${window.identifier}.${key}`
            });
        });
    };

    const getStorage = async (key) => {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Timeout: A operação demorou mais de 10 segundos.' });
            }, 10000);

            socket.on(`storage.load.res.${MODULE_NAME}.${window.identifier}.${key}`, (data) => {
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
                response: `storage.load.res.${MODULE_NAME}.${window.identifier}.${key}`
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

    const startRecording = async () => {
        const result = await setStorage('isRecording', true);
        if (result.success) {
            console.log('Recording started');
            if (!document.title.startsWith('🔴 Recording - ')) {
                document.title = '🔴 Recording - ' + document.title;
            }
        } else {
            console.error('Failed to start recording:', result.error);
        }
    };

    const stopRecording = async () => {
        const result = await setStorage('isRecording', false);
        if (result.success) {
            console.log('Recording stopped');
            document.title = document.title.replace('🔴 Recording - ', '');
            const { value: recordingTitle } = await Swal.fire({
                title: 'Enter recording title',
                input: 'text',
                inputLabel: 'Recording title',
                inputPlaceholder: 'Enter the name for this recording',
                showCancelButton: true
            });

            if (recordingTitle) {
                console.log('Recording title:', recordingTitle);
                // Save the recording title to storage or perform any other necessary action
            } else {
                console.log('Recording title input was cancelled');
            }
        } else {
            console.error('Failed to stop recording:', result.error);
        }
    };

    const toggleRecording = async () => {
        const isRecording = await getVariable('isRecording', false);
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    };

    const applyRecordingIconIfRecording = async () => {
        const isRecording = await getVariable('isRecording', false);
        if (isRecording && !document.title.startsWith('🔴 Recording - ')) {
            document.title = '🔴 Recording - ' + document.title;
        }
    };

    socket.on('connect', () => {
        console.log('Connected to WebSocket server');

        socket.on(`${MODULE_NAME}:event`, (data) => {
            console.log('Received event:', data);
        });
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });

    document.addEventListener('keydown', async (event) => {
        if (event.ctrlKey && event.altKey && event.code === 'KeyR') {
            console.log('Control + Alt + R pressed');
            await toggleRecording();
        }
    });

    await applyRecordingIconIfRecording();  // Check and apply recording icon on load
})();
