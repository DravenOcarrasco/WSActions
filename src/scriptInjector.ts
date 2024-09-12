import { Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';

export class ScriptInjector {
    // Injetar script a partir de um arquivo usando page.evaluate
    async injectScriptFromFile(page: Page, scriptPath: string): Promise<void> {
        try {
            const absolutePath = path.resolve(scriptPath);
            const scriptContent = fs.readFileSync(absolutePath, 'utf-8');
            await page.evaluate(scriptContent);
        } catch (error) {
            console.error(`Erro ao injetar script a partir do arquivo ${scriptPath}:`, error);
        }
    }

    // Injetar script a partir de um arquivo como se fosse digitado no console
    async injectScriptFromConsole(page: Page, scriptPath: string): Promise<void> {
        try {
            const absolutePath = path.resolve(scriptPath);
            const scriptContent = fs.readFileSync(absolutePath, 'utf-8');
            await page.evaluate(scriptContent);
        } catch (error) {
            //console.error(`Erro ao injetar script a partir do console com o arquivo ${scriptPath}:`, error);
        }
    }

    // Injetar script diretamente a partir de uma string de texto
    async injectScriptFromString(page: Page, scriptContent: string): Promise<void> {
        try {
            await page.evaluate(scriptContent);
        } catch (error) {
            console.error('Erro ao injetar script a partir da string:', error);
        }
    }
}
