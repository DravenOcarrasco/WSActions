// ==UserScript==
// @name         WebSocket Client for Tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.13
// @description  Connects to a secure WebSocket server and performs actions based on commands received
// @author       Your Name
// @match        *://*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Função para adicionar um script ao documento
    function addScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.info(`EXT_DONE: ${src}`);
                resolve();
            };
            script.onerror = () => {
                console.error(`Erro ao carregar ${src}`);
                Swal.fire({
                    icon: 'error',
                    title: 'Erro ao carregar extensão',
                    text: `Não foi possível carregar a extensão do URL: ${src}`,
                    confirmButtonText: 'Ok'
                });
                reject(new Error(`Erro ao carregar ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    async function loadExtension(extension){
        const scriptUrl = `http://127.0.0.1:9514/${extension.NAME}/client`;
        addScript(scriptUrl).then(()=>{
            
        }).catch(()=>{

        });
    }

    // Carrega as bibliotecas necessárias
    async function loadLibraries() {
        const libraries = [
            'https://code.jquery.com/jquery-3.6.0.min.js',
            'https://cdn.jsdelivr.net/npm/sweetalert2@11',
            'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.4.0/socket.io.js'
        ];

        try {
            await Promise.all(libraries.map(addScript));
            console.info('Todas as bibliotecas foram carregadas com sucesso.');
        } catch (error) {
            console.error('Erro ao carregar as bibliotecas:', error);
        }
    }

    // Função para carregar as extensões habilitadas
    async function loadEnabledExtensions() {
        try {
            const response = await fetch('http://127.0.0.1:9514/extensions');
            const data = await response.json();
            const enabledExtensions = data.ENABLED || [];

            if (enabledExtensions.length === 0) {
                console.log('Nenhuma extensão habilitada encontrada.');
                return;
            }

            console.log('Extensões habilitadas:', enabledExtensions);

            // Espera 10 segundos antes de começar a carregar as extensões
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Carrega os scripts das extensões habilitadas
            await Promise.all(enabledExtensions.map(extension => {
                loadExtension(extension)
            }));

        } catch (error) {
            console.error('Erro ao carregar extensões:', error);
            setTimeout(() => {
                window.open('http://127.0.0.1:9514/extensions', '_blank');
            }, 5000);
        }
    }

    // Executa o carregamento das bibliotecas e extensões
    (async function init() {
        await loadLibraries();
        await loadEnabledExtensions();
    })();

})();
