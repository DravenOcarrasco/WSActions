"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openProfile = exports.scheduleProfiles = void 0;
const node_schedule_1 = __importDefault(require("node-schedule"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./logger"));
const chromeManager_1 = require("../chromeManager");
const config_1 = require("../config"); // Certifique-se de que o caminho está correto
const config = (0, config_1.loadConfig)();
const chromeManager = new chromeManager_1.ChromeManager(config.chromeProfilePath);
// Função para criar um arquivo de agendamento padrão
const createDefaultScheduleFile = (filePath) => {
    const defaultSchedules = [
        {
            name: "EveryFiveMinutes",
            profiles: ['BLOCK30'],
            scripts: ['script1.js'],
            schedule: '*/5 * * * *' // A cada 5 minutos
        },
        {
            name: "MorningRoutine",
            profiles: ['BLOCK30'],
            scripts: ['script1.js', 'script2.js'],
            schedule: '0 8 * * *' // Todos os dias às 08:00 AM
        },
        {
            name: "MiddayCheck",
            profiles: ['BLOCK30'],
            scripts: ['script3.js'],
            schedule: '0 12 * * *' // Todos os dias às 12:00 PM
        }
    ];
    fs_1.default.writeFileSync(filePath, JSON.stringify(defaultSchedules, null, 2), 'utf-8');
    logger_1.default.info(`Default schedules file created at ${filePath}`);
};
// Carregar os agendamentos do arquivo JSON
const loadSchedules = () => {
    const filePath = path_1.default.resolve(process.cwd(), 'schedules.json');
    if (!fs_1.default.existsSync(filePath)) {
        logger_1.default.warn(`Schedules file not found. Creating default schedules at ${filePath}`);
        createDefaultScheduleFile(filePath);
    }
    const data = fs_1.default.readFileSync(filePath, 'utf-8');
    const schedules = JSON.parse(data);
    return schedules;
};
// Função para abrir um perfil do Chrome e injetar scripts
const openProfile = (profileName, scripts) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const instance = yield chromeManager.launchProfilesByName(profileName);
        // Para injetar os scripts na página aberta
        for (const script of scripts) {
            const scriptPath = path_1.default.resolve(config.scriptsPath, script);
        }
        logger_1.default.info(`${profileName} opened at ${new Date().toLocaleString()}`);
    }
    catch (err) {
        if (err instanceof Error) {
            logger_1.default.error(`Failed to open profile ${profileName}: ${err.message}`);
        }
        else {
            logger_1.default.error(`Failed to open profile ${profileName}: ${err}`);
        }
    }
});
exports.openProfile = openProfile;
// Função para agendar os perfis
const scheduleProfiles = () => __awaiter(void 0, void 0, void 0, function* () {
    const schedules = loadSchedules();
    schedules.forEach(task => {
        node_schedule_1.default.scheduleJob(task.schedule, () => {
            task.profiles.forEach(profile => {
                openProfile(profile, task.scripts);
            });
        });
        logger_1.default.info(`Scheduled task '${task.name}' for profiles ${task.profiles.join(', ')} to open at ${task.schedule}`);
    });
});
exports.scheduleProfiles = scheduleProfiles;
