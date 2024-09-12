import schedule from 'node-schedule';
import fs from 'fs';
import path from 'path';
import logger from './logger';
import ChromeManager from '../chromeManager';
import { loadConfig } from '../config'; // Certifique-se de que o caminho está correto

const config = loadConfig();

interface ScheduledTask {
    name: string;
    profiles: string[];
    scripts: string[];
    schedule: string; // Cron-style schedule string
}

// Função para criar um arquivo de agendamento padrão
const createDefaultScheduleFile = (filePath: string) => {
    const defaultSchedules: ScheduledTask[] = [
    ];

    const example: ScheduledTask[] = [
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
    fs.writeFileSync(filePath, JSON.stringify(defaultSchedules, null, 4), 'utf-8');
    fs.writeFileSync(filePath+".example", JSON.stringify(example, null, 4), 'utf-8');
    logger.info(`Default schedules file created at ${filePath}`);
};

// Carregar os agendamentos do arquivo JSON
const loadSchedules = (): ScheduledTask[] => {
    const filePath = path.resolve(process.cwd(), 'schedules.json');
    if (!fs.existsSync(filePath)) {
        logger.warn(`Schedules file not found. Creating default schedules at ${filePath}`);
        createDefaultScheduleFile(filePath);
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    const schedules = JSON.parse(data) as ScheduledTask[];
    return schedules;
};

// Função para abrir um perfil do Chrome e injetar scripts
const openProfile = async (profileName: string, scripts: string[]) => {
    try {
        const instance = await ChromeManager.launchProfilesByName(profileName);
        (async ()=>{
            for (const script of scripts) {
                try {
                    const scriptPath = path.resolve(config.scriptsPath, script);
                    const extensionModule = require(scriptPath);
                    await extensionModule.executeScript(instance[0].browser)
                } catch (error:any) {
                    instance[0].browser.close()
                    console.log(error)
                }
            }
        })()
    } catch (err) {
        if (err instanceof Error) {
            logger.error(`Failed to open profile ${profileName}: ${err.message}`);
        } else {
            logger.error(`Failed to open profile ${profileName}: ${err}`);
        }
    }
};

// Função para agendar os perfis
const scheduleProfiles = async () => {
    const schedules = loadSchedules();
    schedules.forEach(task => {
        schedule.scheduleJob(task.schedule, () => {
            task.profiles.forEach(profile => {
                openProfile(profile, task.scripts);
            });
        });
        logger.info(`Scheduled task '${task.name}' for profiles ${task.profiles.join(', ')} to open at ${task.schedule}`);
    });
};

// scheduleProfiles();

export {
    scheduleProfiles,
    openProfile
};
