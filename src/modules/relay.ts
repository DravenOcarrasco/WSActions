import { loadConfig } from "../utils/config";
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'http';
import { Server as SocketIoServer } from 'socket.io';
import { createSeparateWebSocketServer } from "./cli-websocket";
import ModuleController from "../extenssionLoader";
import chalk from 'chalk';  // Usando chalk para colorir o menu
// import ModuleController from './ModuleController'; // Importe a classe de módulo

let config = loadConfig();
let relayServer: { io: SocketIoServer, server: HttpServer } | null = null;
let relayClient: ClientSocket | null = null;
let isMaster: boolean = false;
let MainServer: SocketIoServer | null = null;

/**
 * Função para inicializar o relay baseado na configuração (master/slave)
 * @param {SocketIoServer} server - O servidor principal de WebSocket
 */
const initRelay = async (server: SocketIoServer) => {
    MainServer = server; // Atribui o servidor principal

    if (config.relay.enabled) {
        if (config.relay.mode === "master") {
            console.log(chalk.blue.bold("Iniciando o relay no modo master..."));

            // Escuta eventos no servidor principal e envia para os clientes conectados ao relay
            MainServer.on('connection', (socket) => {
                socket.onAny((event: string, args: any) => {
                    sendEventToClients(event, args);  // Envia diretamente o JSON para os clientes conectados ao relay
                });
            });

            // Inicializa o relay como servidor (master)
            relayServer = await createSeparateWebSocketServer(9515);

            isMaster = true;
            console.log(chalk.green.bold("✅ Servidor relay iniciado no modo master."));
        } else if (config.relay.mode === "slave") {
            console.log(chalk.blue.bold("Iniciando o relay no modo slave..."));
            console.log(chalk.cyan(`🔌 Conectando ao relay master em ${chalk.underline(`${config.relay.ip}:${config.relay.port}`)}...`));

            // Inicializa o relay como cliente (slave) e se conecta ao servidor relay (master)
            relayClient = SocketIOClient(`http://${config.relay.ip}:${config.relay.port}`, {
                reconnectionAttempts: 5,  // Tenta reconectar automaticamente
                timeout: 2000             // Tempo de espera para conexão (em ms)
            });

            const EXTENSIONS = ModuleController.EXTENSIONS;
            // Evento de conexão bem-sucedida
            relayClient.on("connect", () => {
                console.log(chalk.green.bold("✅ Conectado ao servidor relay com sucesso."));
                EXTENSIONS.ENABLED.forEach(EXT => {
                    Object.entries(EXT.IOEVENTS).forEach(([event, handler]) => {
                        relayClient?.on(`${EXT.NAME}.${event}`, handler._function);
                    });
                });
            });

            // Evento de desconexão
            relayClient.on("disconnect", () => {
                console.log(chalk.yellow("⚠️  Desconectado do servidor relay."));
            });

            // Escutando todos os eventos do servidor relay e repassando ao MainServer
            relayClient.onAny((eventName: string, data: any) => {
                MainServer?.emit(eventName, data); // Repasse para os clientes do MainServer
            });

            // Tratamento de erros de conexão
            relayClient.on("connect_error", (err: any) => {
                console.error(chalk.red.bold("❌ Erro ao se conectar ao servidor relay:"), err);
            });

            relayClient.on("reconnect_attempt", (attempt) => {
                console.log(chalk.yellow(`🔄 Tentativa de reconexão ao servidor relay (tentativa ${attempt})`));
            });

            relayClient.on("reconnect", () => {
                console.log(chalk.green.bold("✅ Reconectado ao servidor relay com sucesso."));
            });

            relayClient.on("reconnect_failed", () => {
                console.error(chalk.red.bold("❌ Falha ao reconectar ao servidor relay."));
            });
            isMaster = false;
        }
    } else {
        console.log(chalk.gray("ℹ️  O relay está desativado nas configurações."));
    }
};

/**
 * Envia um evento para todos os clientes conectados ao servidor WebSocket.
 * @param {string} event - O nome do evento a ser emitido.
 * @param {any} data - O objeto JSON associado ao evento.
 */
const sendEventToClients = (event: string, data: any): void => {
    if (config.relay.mode === "master") {
        if (relayServer?.io) {
            relayServer.io.emit(event, data);  // Envia o JSON diretamente
        }
    }
};

export {
    isMaster,
    relayClient,
    relayServer,
    initRelay,
    sendEventToClients
};
