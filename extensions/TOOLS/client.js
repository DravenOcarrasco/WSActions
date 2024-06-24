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
    const MODULE_NAME = "TOOLS"
    const socket = io('https://127.0.0.1:9515/', { secure: true }); // Conexão segura via HTTPS

    const getStorage = async ()=>{
        
    }
    
    const setStorage = async ()=>{

    }

    
    let isMaster = false; // Variável para controlar se o cliente é o mestre
    let maxDelay = 2000; // Tempo máximo de atraso em milissegundos
    const actionQueue = []; // Fila de ações
    let isProcessing = false; // Variável para verificar se a fila está sendo processada
    let isExecuting = false; // Variável para verificar se uma ação replicada está sendo executada

    // Função para processar a fila de ações
    function processActionQueue() {
        if (actionQueue.length === 0) {
            isProcessing = false; // Fila vazia, definir isProcessing como falso
            return;
        }

        isProcessing = true; // Iniciar processamento
        const { payload } = actionQueue.shift();
        const delay = Math.floor(Math.random() * maxDelay) + 1000; // Atraso aleatório entre 1 e maxDelay segundos

        setTimeout(() => {
            isExecuting = true;
            executeReplicatedAction(payload);
            isExecuting = false;
            processActionQueue(); // Processar próxima ação na fila
        }, delay);
    }

    // Função para enviar comandos
    function sendCommand(command, data) {
        if (isMaster) {
            socket.emit(`${MODULE_NAME}.master:command`, { command, data });
        } else {
            console.log('Este cliente não é o mestre.');
        }
    }

    // Função para capturar ações e enviá-las ao servidor
    function captureAction(event) {
        if (isMaster && !isExecuting) {
            const element = event.target;
            const tagName = element.tagName;
            const action = event.type;
            const value = element.value;
            const selector = getElementXPath(element);
            sendCommand('replicateAction', { tagName, action, value, selector });
        }
    }

    // Função para obter o XPath de um elemento
    function getElementXPath(element) {
        const paths = [];
        for (; element && element.nodeType == Node.ELEMENT_NODE; element = element.parentNode) {
            let index = 0;
            for (let sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName == element.nodeName) ++index;
            }
            const tagName = element.nodeName.toLowerCase();
            const pathIndex = (index ? `[${index + 1}]` : '');
            paths.unshift(`${tagName}${pathIndex}`);
        }
        return paths.length ? `/${paths.join('/')}` : null;
    }

    // Função para adicionar o botão de controle mestre após 10 segundos
    function addMasterControlButton() {
        setTimeout(() => {
            const button = document.createElement('button');
            button.innerText = 'Tornar-se Mestre';
            button.style.position = 'fixed';
            button.style.bottom = '10px';
            button.style.right = '10px';
            button.style.zIndex = 1000;
            button.addEventListener('click', () => {
                isMaster = true;
                Swal.fire('Mestre', 'Este cliente agora é o mestre.', 'success');
            });
            document.body.appendChild(button);
        }, 10000);
    }

    socket.on('connect', () => {
        console.log('Conectado ao servidor WebSocket');

        // Adiciona o botão para tornar-se mestre
        addMasterControlButton();

        // Recebe comandos do mestre e do servidor
        socket.on(`${MODULE_NAME}:command`, (data) => {
            if (!data) return;
            const { command, data: payload } = data;
            if (command === 'browser:openPage') {
                window.location.href = data.payload;
            } else if (command === 'browser:reloadPage') {
                window.location.reload();
            } else if (command === 'blockpick:collectRewards') {
                collectRewards();
            } else if (command === 'global:control') {
                executeGlobalControl(payload);
            } else if (command === 'button:click') {
                clickButton(payload);
            } else if (command === 'replicateAction') {
                if (!payload) return;
                if (isMaster) return;
                actionQueue.push({ payload });
                if (!isProcessing) processActionQueue(); // Inicia o processamento se a fila não estiver sendo processada
            } else if (command === 'setMaxDelay') {
                maxDelay = payload;
                Swal.fire('Atualizado!', `Novo tempo máximo de atraso definido para ${maxDelay / 1000} segundos.`, 'success');
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('Desconectado do servidor WebSocket');
    });

    function collectRewards() {
        const rewardsButton = $("span").filter(function () {
            return $(this).text().trim() === "My Rewards";
        });

        if (rewardsButton.length) {
            console.log('Botão "My Rewards" encontrado, clicando nele...');
            rewardsButton.click();

            setTimeout(() => {
                console.log('10 segundos se passaram após clicar no botão "My Rewards"');

                const claimButton = $("span").filter(function () {
                    return $(this).text().trim() === "Claim";
                });

                if (claimButton.length) {
                    console.log('Botão "Claim" encontrado, clicando nele...');
                    claimButton.click();
                } else {
                    console.log('Botão "Claim" não encontrado');
                }
            }, 10000);
        } else {
            console.log('Botão "My Rewards" não encontrado');
        }
    }

    function executeGlobalControl(data) {
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"], textarea');
        inputs.forEach((input, index) => {
            input.value = data || `Valor ${index}`;
            const event = new Event('input', { bubbles: true });
            input.dispatchEvent(event);
        });
        console.log('Inputs preenchidos.');
    }

    function clickButton(selector) {
        const button = document.querySelector(selector);
        if (button) {
            button.click();
            console.log(`Botão com o seletor "${selector}" foi clicado.`);
        } else {
            console.log(`Botão com o seletor "${selector}" não foi encontrado.`);
        }
    }

    function executeReplicatedAction(payload) {
        const { selector, action, value } = payload;
        console.log(`Tentando executar ação: ${action} em ${selector}`);
        const element = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (element) {
            console.log(`Elemento encontrado: ${element.tagName}`);
            if (action === 'click') {
                element.click();
            } else if (action === 'input' || action === 'change') {
                element.value = value;
                element.dispatchEvent(new Event(action, { bubbles: true }));
            }
            console.log(`Ação replicada: ${action} em ${selector}`);
        } else {
            console.log(`Elemento não encontrado para replicar a ação: ${selector}`);
        }
    }

    // Adiciona evento de teclado para tornar-se mestre com Ctrl+M e definir atraso máximo com Ctrl+D
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.key === 'm') {
            isMaster = true;
            Swal.fire('Mestre', 'Este cliente agora é o mestre.', 'success');
        } else if (isMaster && event.ctrlKey && event.key === 'Enter') {
            sendCommand('global:control', 'Valor de exemplo');
        } else if (isMaster && event.ctrlKey && event.key === 'b') {
            // Enviar comando para clicar em um botão com um seletor específico
            const selector = 'button.exemplo'; // Troque pelo seletor do botão que deseja controlar
            sendCommand('button:click', selector);
        } else if (event.ctrlKey && event.key === 'd') {
            Swal.fire({
                title: 'Definir atraso máximo',
                input: 'number',
                inputLabel: 'Digite o novo tempo máximo de atraso em segundos',
                inputValue: maxDelay / 1000,
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value || isNaN(value) || value <= 0) {
                        return 'Por favor, insira um valor válido!';
                    }
                    return null;
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    maxDelay = parseInt(result.value) * 1000;
                    Swal.fire('Atualizado!', `Novo tempo máximo de atraso definido para ${maxDelay / 1000} segundos.`, 'success');
                    sendCommand('setMaxDelay', maxDelay);
                }
            });
        }
    });

    // Captura ações de clique e mudança de valor em elementos de input
    document.addEventListener('click', captureAction, true);
    document.addEventListener('input', captureAction, true);
    document.addEventListener('change', captureAction, true);
})();
