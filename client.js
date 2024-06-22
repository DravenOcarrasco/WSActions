// ==UserScript==
// @name         WebSocket Client for Tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.13
// @description  Connects to a secure WebSocket server and performs actions based on commands received
// @author       Your Name
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Incluindo a biblioteca jQuery, SweetAlert e Socket.IO diretamente no script
    const jqueryScript = document.createElement('script');
    jqueryScript.src = 'https://code.jquery.com/jquery-3.6.0.min.js';
    document.head.appendChild(jqueryScript);

    const sweetAlertScript = document.createElement('script');
    sweetAlertScript.src = 'https://cdn.jsdelivr.net/npm/sweetalert2@11';
    document.head.appendChild(sweetAlertScript);

    const socketScript = document.createElement('script');
    socketScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.4.0/socket.io.js'; // Caminho para a biblioteca Socket.IO
    document.head.appendChild(socketScript);

    // Função para adicionar um script ao documento
    function addScript(src) {
        const script = document.createElement('script');
        script.src = src;
        document.head.appendChild(script);
    }

    function loadEnabledExtensions() {
        return fetch('https://127.0.0.1:9515/extensions')
            .then(response => response.json())
            .then(data => data.ENABLED)
            .catch(error => {
                console.error('Erro ao carregar extensões:', error);
                setTimeout(()=>{
                    window.open("https://127.0.0.1:9515/extensions", '_blank');
                }, 5000)
                return [];
            });
    }
    loadEnabledExtensions().then(enabledExtensions => {
        console.log(enabledExtensions)
        if (enabledExtensions.length === 0) {
            console.log('Nenhuma extensão habilitada encontrada.');
            return;
        }

        console.log('Extensões habilitadas:', enabledExtensions);

        // Carrega os scripts das extensões habilitadas
        enabledExtensions.forEach(extension => {
            if (extension.CLIENT_LINK) {
                const scriptUrl = `https://127.0.0.1:9515/${extension.CLIENT_LINK}`;
                addScript(scriptUrl);
            }
        });
    })

})();
