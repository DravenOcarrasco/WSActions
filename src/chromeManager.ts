import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { ScriptInjector } from './scriptInjector';
import { loadConfig } from './config'; // Importa a função de configuração
import { ChromeProfileInfo } from './interfaces/ChromeProfileInfo';

const scriptInjector = new ScriptInjector();
const config = loadConfig(); // Carrega a configuração

interface ChromeInstance {
    browser: Browser;
    page: Page;
}

export class ChromeManager {
    private instances: ChromeInstance[] = [];
    private profilePath: string;

    constructor(profilePath: string) {
        this.profilePath = profilePath;
    }

    // Launch a new Chrome instance
    async launchChrome(profileDirectory?: string): Promise<ChromeInstance> {
        const args = [
            '--disable-web-security', // Disable web security
            '--disable-features=IsolateOrigins,site-per-process', // Disable site isolation
            '--allow-running-insecure-content', // Allow running insecure content
            '--disable-features=TrustedTypes', // Disable TrustedTypes
        ];
        if (profileDirectory) {
            args.push(`--profile-directory='${profileDirectory}'`);
        }
        const browser = await puppeteer.launch({
            headless: false, // Set headless to false to open the browser with a UI
            userDataDir: this.profilePath, // Set Chrome profile path
            args,
        });

        browser.on('targetcreated', async (target) => {
            const newPage = await target.page();
            if (newPage) {
                await this.setupPage(newPage, profileDirectory);
            }
        });

        const page = await browser.newPage();
        
        await page.goto(config.defaultPageUrl);
        let pages = await browser.pages();
        if (pages.length > 1) {
            await pages[0].close();
        }

        await this.setupPage(page);

        const instance = { browser, page };
        this.instances.push(instance);
        return instance;
    }

    // Setup page settings and script injection
    private async setupPage(page: Page, profileDirectory?: string): Promise<void> {
        await page.setBypassCSP(true); // Bypass CSP
        await page.setViewport({ width: 1300, height: 720 })
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                if (profileDirectory) {
                    await scriptInjector.injectScriptFromString(page, `if(window.identifier == undefined) window.identifier = '${profileDirectory}'`);
                }
                await this.injectScript(page);
            }
        });

        page.on('framenavigationfailed', async (frame) => {
            if (frame === page.mainFrame()) {
                if (profileDirectory) {
                    await scriptInjector.injectScriptFromString(page, `if(window.identifier == undefined) window.identifier = '${profileDirectory}'`);
                }
                await this.injectScript(page);
            }
        });

        if (profileDirectory) {
            await scriptInjector.injectScriptFromString(page, `if(window.identifier == undefined) window.identifier = '${profileDirectory}'`);
        }
        await this.injectScript(page);

        // Handle popups
        page.on('popup', async (popupPage: Page | null) => {
            if (popupPage) {
                await this.setupPage(popupPage);
            }
        });
    }

    // Inject script into a page
    private async injectScript(page: Page): Promise<void> {
        try {
            // let window:any;
            // const scriptAlreadyInjected = await page.evaluate(() => {
            //     if ((window as any).__scriptInjected) {
            //         return true;
            //     } else {
            //         (window as any).__scriptInjected = true;
            //         return false;
            //     }
            // });

            // if (!scriptAlreadyInjected) {
            //     await scriptInjector.injectScriptFromConsole(page, path.join(process.cwd(), config.scriptsPath));
            //     //console.log('Script injected successfully into frame:', page.url());
            // }
            await scriptInjector.injectScriptFromConsole(page, path.join(process.cwd(), config.scriptsPath));
        } catch (error) {
            console.error('Error injecting script:', error);
        }
    }

    // Close a specific Chrome instance
    async closeChrome(instance: ChromeInstance): Promise<void> {
        await instance.browser.close();
        this.instances = this.instances.filter(i => i !== instance);
    }

    // Close all Chrome instances
    async closeAll(): Promise<void> {
        for (const instance of this.instances) {
            await instance.browser.close();
        }
        this.instances = [];
    }

    // Get all active instances
    getInstances(): ChromeInstance[] {
        return this.instances;
    }

    // List all profiles
    listProfiles(): ChromeProfileInfo[] {
        const localStatePath = path.join(this.profilePath, 'Local State');
        if (!fs.existsSync(localStatePath)) {
            throw new Error(`Local State file not found: ${localStatePath}`);
        }

        const localStateContent = fs.readFileSync(localStatePath, 'utf-8');
        const localStateJson = JSON.parse(localStateContent);

        if (!localStateJson.profile || !localStateJson.profile.info_cache) {
            throw new Error('Invalid Local State format');
        }

        const profiles: ChromeProfileInfo[] = [];
        for (const key in localStateJson.profile.info_cache) {
            profiles.push({
                ...localStateJson.profile.info_cache[key],
                folder_name: key,
            });
        }

        return profiles;
    }

    // Get a specific profile path
    getProfilePath(profileName: string): string {
        const profilePath = path.join(this.profilePath, profileName);
        if (!fs.existsSync(profilePath)) {
            throw new Error(`Profile not found: ${profileName}`);
        }
        return profileName; // Return just the profile directory name
    }

    // Launch a range of Chrome profiles
    async launchProfilesRange(start: number, end: number): Promise<void> {
        const profiles = this.listProfiles();
        const profileNames = profiles.slice(start, end + 1).map(profile => profile.folder_name);
        for (const profileName of profileNames) {
            await this.launchChrome(profileName);
        }
    }

    // Launch profiles based on regex
    async launchProfilesByRegex(regex: RegExp): Promise<void> {
        const profiles = this.listProfiles();
        const profileNames = profiles.filter(profile => regex.test(profile.folder_name)).map(profile => profile.folder_name);
        for (const profileName of profileNames) {
            await this.launchChrome(profileName);
        }
    }

    // Launch profiles by name
    async launchProfilesByName(name: string): Promise<void> {
        const profiles = this.listProfiles();
        const profileNames = profiles.filter(profile => profile.name === name).map(profile => profile.folder_name);
        for (const profileName of profileNames) {
            console.log(profileName);
            await this.launchChrome(profileName);
            return;
        }
    }

    // Launch profiles by initial letter
    async launchProfilesByInitialLetter(letter: string): Promise<void> {
        const profiles = this.listProfiles();
        const profileNames = profiles.filter(profile => profile.name.startsWith(letter)).map(profile => profile.folder_name);
        for (const profileName of profileNames) {
            await this.launchChrome(profileName);
        }
    }

    // Launch profile by index
    async launchProfileByIndex(index: number): Promise<void> {
        const profiles = this.listProfiles();
        if (index >= 0 && index < profiles.length) {
            const profileName = profiles[index].folder_name;
            await this.launchChrome(profileName);
        } else {
            throw new Error(`Profile index out of range: ${index}`);
        }
    }
}
