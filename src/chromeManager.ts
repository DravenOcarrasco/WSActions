import puppeteer from 'puppeteer-extra';
import { Browser, Page, Frame, Target } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { ScriptInjector } from './scriptInjector';
import { loadConfig } from './config'; // Importa a função de configuração
import { exec } from 'child_process';
import { ChromeProfileInfo } from './interfaces/ChromeProfileInfo';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import RecaptchaPlugin from 'puppeteer-extra-plugin-recaptcha';

const scriptInjector = new ScriptInjector();
const config = loadConfig(); // Carrega a configuração


const puppeteerStealth = StealthPlugin();
puppeteerStealth.enabledEvasions.delete('user-agent-override');

puppeteer.use(puppeteerStealth)
// puppeteer.use(RecaptchaPlugin())

interface ChromeInstance {
    browser: Browser;
    page: Page;
}
interface GroupInfo {
    name: string;
    profiles: string[];
    extensions: string[];
}

interface ProfilesData {
    profiles: ChromeProfileInfo[];
    groups: GroupInfo[];
    defaultExtensions: string[];
}

let instances: ChromeInstance[] = [];
let profilePath: string;
const profilesFileName = 'profiles.json';

function initializeChromeManager(profileDirectory: string) {
    profilePath = profileDirectory;
    if (!fs.existsSync(profilePath)) {
        fs.mkdirSync(profilePath, { recursive: true });
        fs.mkdirSync(path.join(profilePath, 'extensions'), { recursive: true });
    }
    initializeProfilesFile();
}

function initializeProfilesFile() {
    const profilesFilePath = path.join(profilePath, profilesFileName);
    if (!fs.existsSync(profilesFilePath)) {
        const initialData: ProfilesData = { profiles: [], groups: [], defaultExtensions: [] };
        fs.writeFileSync(profilesFilePath, JSON.stringify(initialData, null, 4));
    }
}

// Update the profiles.json file
function updateProfilesFile(profileData: ProfilesData) {
    const profilesFilePath = path.join(profilePath, profilesFileName);
    fs.writeFileSync(profilesFilePath, JSON.stringify(profileData, null, 4));
}

// Get profiles data
function getProfilesData(): ProfilesData {
    const profilesFilePath = path.join(profilePath, profilesFileName);
    const profilesContent = fs.readFileSync(profilesFilePath, 'utf-8');
    return JSON.parse(profilesContent);
}

// Função para navegar para uma URL de maneira segura
async function safeGoto(page: Page, url: string): Promise<void> {
    if (!page.isClosed()) {
        try {
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        } catch (error: any) {
            if (error.message.includes('Frame was detached')) {
                console.warn('Frame was detached during navigation, retrying...');
                await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
            } else {
                console.error('Error navigating:', error.message);
                throw error; // Rethrow other errors
            }
        }
    } else {
        console.warn('Page is already closed, cannot navigate.');
    }
}

// Função para lançar uma nova instância do Chrome
async function launchChrome(profileName: string, extensions: string[], profileInfo: ChromeProfileInfo): Promise<ChromeInstance> {
    const extensionPaths = extensions.join(',');
    const args = [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--allow-running-insecure-content',
        '--disable-features=TrustedTypes',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-gpu',
        `--disable-extensions-except=${extensionPaths}`,
        '--disable-infobars'
    ];

    if (profileInfo.proxy?.enabled) {
        args.push(`--proxy-server=${profileInfo.proxy.ip}`);
    }

    const browser = await puppeteer.launch({
        headless: profileInfo.headless,
        executablePath: config.chromeExecutablePath,
        userDataDir: path.join(profilePath, profileName),
        args
    });

    browser.on('targetcreated', async (target: Target) => {
        try {
            const newPage = await target.page();
            if (newPage) {
                await setupPage(newPage, profileName);
            }
        } catch (error) {
            console.error('Error setting up new page:', error);
        }
    });

    const monitorPages = async () => {
        const injectedPages = new Set(); // Manter um conjunto de páginas já injetadas
    
        while (true) {
            const pages = await browser.pages();
            // Verifica se não há páginas abertas e fecha o navegador
            if (pages.length === 0) {
                console.log(`Nenhuma página aberta no perfil ${profileName}. Fechando navegador...`);
                await browser.close();
                instances = instances.filter(i => i.browser !== browser);
                break;
            }
    
            // Percorre todas as páginas abertas e injeta o script nas que ainda não foram injetadas
            for (const page of pages) {
                if (!injectedPages.has(page)) {
                    try {
                        // Verifica se a página está carregada
                        const isPageLoaded = await page.evaluate(() => document.readyState === 'complete');
                        if (isPageLoaded) {
                            await setupPage(page, profileName); // Configuração da página antes de injetar o script
                            await page.setBypassCSP(true); // Ignora CSP para permitir a injeção
                            await injectScript(page); // Função de injeção do script
                            injectedPages.add(page); // Marca a página como injetada
                            
                            await setupPage(page, profileName); // Configuração da página antes de injetar o scrip
                        } else {
                            console.log(`Página ainda não está completamente carregada, tentando novamente mais tarde.`);
                        }
                    } catch (error: any) {
                        console.error(`Erro ao configurar ou injetar o script: ${error.message}`);
                    }
                }
            }
            // Espera 3 segundos antes de verificar novamente
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    let [page] = await browser.pages();
    if (!page) {
        page = await browser.newPage();
    }

    try {
        await safeGoto(page, config.defaultPageUrl);
    } catch (error: any) {
        if (error.message && error.message.includes('Navigating frame was detached')) {
            console.warn('Frame was detached during navigation, retrying...');
        } else {
            console.error('Error navigating to default page:', error);
        }
    }

    if (profileInfo.proxy && profileInfo.proxy.enabled) {
        await page.authenticate({
            username: profileInfo.proxy.user,
            password: profileInfo.proxy.passw,
        });
    }

    try {
        await safeGoto(page, config.defaultPageUrl);
        await page.reload({ waitUntil: 'networkidle0' });
    } catch (error) {
        //console.error('Error navigating to default page:', error);
    }

    // Iniciar monitoramento de páginas
    monitorPages();
    const instance = { browser, page };
    instances.push(instance);
    return instance;
}

// Setup page settings and script injection
async function setupPage(page: Page, profileName: string): Promise<void> {
    try {
        await page.setBypassCSP(true);
        const injectScripts = async () => {
            try {
                const ip = '127.0.0.1'; // Pode ser variável
                const port = 9514; // Pode ser variável
                const identifier = profileName;
                const delay = 1; // Pode ser variável
                const script = `
                    if (!window.WSACTION) {
                        window.WSACTION = { config: {} };
                    }
                    window.WSACTION.config = {
                        ip: '${ip}',
                        port: ${port},
                        identifier: '${identifier}',
                        delay: ${delay}
                    };
                `;
                await scriptInjector.injectScriptFromString(page, script);
                await injectScript(page);
            } catch (error) {
                console.error('Error during script injection:', error);
            }
        };

        // Inject script once the page is fully loaded
        page.once('load', async () => {
            await injectScripts();
        });

        // Inject script once the DOM content is fully loaded
        page.once('domcontentloaded', async () => {
            await injectScripts();
        });

        // Reinject scripts when the main frame navigates
        page.on('framenavigated', async (frame) => {
            if (frame === page.mainFrame()) {
                await injectScripts();
            }
        });
        await injectScripts();
    } catch (error) {
        console.error('Erro durante a configuração da página:', error);
    }
}

// Inject script into a page
async function injectScript(page: Page): Promise<void> {
    try {
        await scriptInjector.injectScriptFromConsole(page, path.join(process.cwd(), "scripts", "injector.js"));
    } catch (error) {
        console.error('Error injecting script:', error);
    }
}

// Get profile info by name
function getProfileInfo(profileName: string): ChromeProfileInfo | undefined {
    const profileData = getProfilesData();
    return profileData.profiles.find(profile => profile.name === profileName);
}

// Close a specific Chrome instance
async function closeChrome(instance: ChromeInstance): Promise<void> {
    await instance.browser.close();
    instances = instances.filter(i => i !== instance);
}

// Close all Chrome instances
async function closeAll(): Promise<void> {
    for (const instance of instances) {
        await instance.browser.close();
    }
    instances = [];
}

// Get all active instances
function getInstances(): ChromeInstance[] {
    return instances;
}

// Create a new profile
function createProfile(profileName: string): void {
    const profileDirPath = path.join(profilePath, profileName);
    if (!fs.existsSync(profileDirPath)) {
        fs.mkdirSync(profileDirPath);
    } else {
        throw new Error(`Profile already exists: ${profileName}`);
    }

    const profileData = getProfilesData();
    const profileInfo: ChromeProfileInfo = {
        folder_name: profileName,
        name: profileName,
        shortcut_name: profileName,
        extensions: profileData.defaultExtensions, // Add default extensions to new profile
        proxy: {
            enabled: false,
            ip: "ip:port",
            user: "",
            passw: ""
        },
        headless: false
    };

    fs.writeFileSync(path.join(profileDirPath, 'profile_info.json'), JSON.stringify(profileInfo, null, 4));

    // Update the profiles.json file
    profileData.profiles.push(profileInfo);
    updateProfilesFile(profileData);

    // Create a shortcut for the new profile
    createChromeProfileShortcut(profileName, path.join(process.cwd(), 'shortcuts', `${profileName}.lnk`));
}

// Remove a profile
function removeProfile(profileName: string): void {
    const profileDirPath = path.join(profilePath, profileName);
    if (fs.existsSync(profileDirPath)) {
        fs.rmSync(profileDirPath, { recursive: true, force: true });
    } else {
        throw new Error(`Profile not found: ${profileName}`);
    }

    // Update the profiles.json file
    let profileData = getProfilesData();
    profileData.profiles = profileData.profiles.filter(profile => profile.folder_name !== profileName);
    updateProfilesFile(profileData);
}

// Add a new group
function addGroup(groupName: string): void {
    const profileData = getProfilesData();
    if (profileData.groups.some(group => group.name === groupName)) {
        throw new Error(`Group already exists: ${groupName}`);
    }

    const newGroup: GroupInfo = {
        name: groupName,
        profiles: [],
        extensions: []
    };

    profileData.groups.push(newGroup);
    updateProfilesFile(profileData);

    // Create a shortcut for the new group
    createGroupShortcut(groupName, path.join(process.cwd(), 'shortcuts', `${groupName}.lnk`));
}

// Remove a group
function removeGroup(groupName: string): void {
    const profileData = getProfilesData();
    const groupIndex = profileData.groups.findIndex(group => group.name === groupName);
    if (groupIndex === -1) {
        throw new Error(`Group not found: ${groupName}`);
    }

    profileData.groups.splice(groupIndex, 1);
    updateProfilesFile(profileData);

    // Remove the shortcut for the group
    const shortcutPath = path.join(process.cwd(), 'shortcuts', `${groupName}.lnk`);
    if (fs.existsSync(shortcutPath)) {
        fs.unlinkSync(shortcutPath);
    }
}

// List all profiles
function listProfiles(): string[] {
    const profileData = getProfilesData();
    return profileData.profiles.map(profile => profile.folder_name);
}

// List all profiles with info
function listProfilesInfo(): ChromeProfileInfo[] {
    const profileData = getProfilesData();
    return profileData.profiles;
}

// Add a profile to a group
function addProfileToGroup(groupName: string, profileName: string): void {
    const profileData = getProfilesData();
    const group = profileData.groups.find(group => group.name === groupName);
    if (!group) {
        throw new Error(`Group not found: ${groupName}`);
    }

    if (!group.profiles.includes(profileName)) {
        group.profiles.push(profileName);
    }
    updateProfilesFile(profileData);
}

// Add an extension to a profile
function addExtensionToProfile(profileName: string, extension: string): void {
    const profileData = getProfilesData();
    const profile = profileData.profiles.find(profile => profile.folder_name === profileName);
    if (!profile) {
        throw new Error(`Profile not found: ${profileName}`);
    }

    if (!profile.extensions.includes(extension)) {
        profile.extensions.push(extension);
    }
    updateProfilesFile(profileData);
}

// Add an extension to a group
function addExtensionToGroup(groupName: string, extension: string): void {
    const profileData = getProfilesData();
    const group = profileData.groups.find(group => group.name === groupName);
    if (!group) {
        throw new Error(`Group not found: ${groupName}`);
    }

    if (!group.extensions.includes(extension)) {
        group.extensions.push(extension);
    }
    updateProfilesFile(profileData);
}

// Launch profiles by name
async function launchProfilesByName(name: string): Promise<ChromeInstance[]> {
    const instances:ChromeInstance[] = []
    var extensions = [...new Set([...getProfilesData().defaultExtensions, ...getProfileInfo(name)?.extensions ?? []])];
    const profiles = listProfilesInfo();
    const profileNames = profiles.filter(profile => profile.name === name).map(profile => profile.folder_name);
    if (profileNames.length === 0) {
        // Profile does not exist, create it
        createProfile(name);
        profileNames.push(name);
    }
    for (const profileName of profileNames) {
        const prof = getProfileInfo(profileName)
        if(prof){
            instances.push(await launchChrome(profileName, extensions, prof));
        }
    }
    return instances
}

// Add default extensions
function addDefaultExtension(extension: string): void {
    const profileData = getProfilesData();
    if (!profileData.defaultExtensions.includes(extension)) {
        profileData.defaultExtensions.push(extension);
    }
    updateProfilesFile(profileData);
}

// Remove default extensions
function removeDefaultExtension(extension: string): void {
    const profileData = getProfilesData();
    profileData.defaultExtensions = profileData.defaultExtensions.filter(ext => ext !== extension);
    updateProfilesFile(profileData);
}

// Create a shortcut for a Chrome profile
function createChromeProfileShortcut(profileName: string, shortcutPath: string): void {
    const workingDir = process.cwd();
    const target = path.resolve(workingDir, path.resolve(process.execPath)); // Caminho para o executável do servidor
    const args = `open-chrome --profile "${profileName}"`;

    // Garantir que o diretório de shortcuts exista
    fs.mkdirSync(path.dirname(shortcutPath), { recursive: true });

    const command = `powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${shortcutPath}'); $s.TargetPath = '${target}'; $s.Arguments = '${args}'; $s.WorkingDirectory = '${workingDir}'; $s.Save()"`;

    exec(command, (error) => {
        if (error) {
            console.error(`Error creating shortcut for profile ${profileName}:`, error);
        } else {
            console.log(`Shortcut for profile ${profileName} created successfully.`);
        }
    });
}

// Create a shortcut to open a group of profiles
function createGroupShortcut(groupName: string, shortcutPath: string): void {
    const workingDir = process.cwd();
    const target = path.resolve(workingDir, path.resolve(process.execPath)); // Caminho para o executável do servidor
    const args = `open-group --name "${groupName}"`;

    const command = `powershell -command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('${shortcutPath}'); $s.TargetPath = '${target}'; $s.Arguments = '${args}'; $s.WorkingDirectory = '${workingDir}'; $s.Save()"`;
    
    fs.mkdirSync(path.dirname(shortcutPath), { recursive: true });

    exec(command, (error) => {
        if (error) {
            console.error(`Error creating shortcut for group ${groupName}:`, error);
        } else {
            console.log(`Shortcut for group ${groupName} created successfully.`);
        }
    });
}

// Get group info by name
function getGroupInfo(groupName: string): GroupInfo | undefined {
    const profileData = getProfilesData();
    return profileData.groups.find(group => group.name === groupName);
}

const ChromeManager = {
    initializeChromeManager,
    launchChrome,
    launchProfilesByName,
    closeChrome,
    closeAll,
    getInstances,
    createProfile,
    removeProfile,
    addGroup,
    removeGroup,
    listProfiles,
    listProfilesInfo,
    getProfilesData,
    getProfileInfo,
    getGroupInfo,
    addProfileToGroup,
    addExtensionToProfile,
    addExtensionToGroup,
    addDefaultExtension,
    removeDefaultExtension
};

export default ChromeManager;
