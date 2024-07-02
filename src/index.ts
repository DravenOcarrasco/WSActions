import './cli'
import { ChromeManager } from './chromeManager';
import { loadConfig } from './config';
import api from './api'
import {scheduleProfiles} from './modules/schedule'

(async () => {
    scheduleProfiles()
    const API = api
    const config = loadConfig()
    const chromeManager = new ChromeManager(config.chromeProfilePath);
    
    chromeManager.launchProfilesByName("BLOCK30")
    // // Launch a new Chrome instance
    // const instance = await chromeManager.launchChrome();
    // await instance.page.setViewport({ width: 1300, height: 720 });

    // // Navegar para uma URL e esperar que a navegação esteja completa
    // await instance.page.goto('https://x.com/?lang=pt-br', { waitUntil: 'networkidle0' });
})();
