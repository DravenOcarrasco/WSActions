// ==UserScript==
// @name         WebSocket Client for Tampermonkey
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  Connects to a secure WebSocket server and performs actions based on commands received
// @author       Your Name
// @match        *://*/*
// @match        file:///*
// @match        chrome-extension://*
// @match        moz-extension://*/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Incluindo o script remoto
    const clientScript = document.createElement('script');
    clientScript.src = 'http://127.0.0.1:9514/client.js';
    document.head.appendChild(clientScript);

    clientScript.onload = () => {
        console.log('client.js carregado com sucesso');
    };

    clientScript.onerror = () => {
        console.error('Erro ao carregar client.js');
    };
})();