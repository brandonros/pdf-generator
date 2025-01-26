import { Mutex } from 'async-mutex';
import puppeteer, { Browser, Page } from 'puppeteer-core';
import { logger } from './logger';

export class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;
    private pages: Array<{ page: Page; inUse: boolean }> = [];
    private mutex = new Mutex();
    private readonly poolSize = 10;
    private readonly browserWSEndpoint = 'wss://chromium.debian-k3s';

    private constructor() {}

    public static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    private async createPage(): Promise<Page> {
        const page = await this.browser!.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        return page;
    }

    async initialize(): Promise<void> {
        if (this.browser) return;

        await this.mutex.acquire();
        try {
            if (!this.browser) {
                this.browser = await puppeteer.connect({
                    browserWSEndpoint: this.browserWSEndpoint
                });

                // Initialize page pool
                for (let i = 0; i < this.poolSize; i++) {
                    const page = await this.createPage();
                    this.pages.push({ page, inUse: false });
                }
                logger.info('Browser and page pool initialized');
            }
        } finally {
            this.mutex.release();
        }
    }

    private async getAvailablePage(): Promise<Page> {
        return await this.mutex.runExclusive(async () => {
            // Find first available page
            const pageEntry = this.pages.find(p => !p.inUse);
            if (pageEntry) {
                pageEntry.inUse = true;
                return pageEntry.page;
            }

            // Create new page if pool is exhausted
            logger.warn('Page pool exhausted, creating new page');
            const newPage = await this.createPage();
            this.pages.push({ page: newPage, inUse: true });
            return newPage;
        });
    }

    private async releasePage(page: Page): Promise<void> {
        await this.mutex.runExclusive(async () => {
            const pageEntry = this.pages.find(p => p.page === page);
            if (pageEntry) {
                await page.goto('about:blank');
                pageEntry.inUse = false;
            }
        });
    }

    async capturePDF(url: string): Promise<Uint8Array> {
        if (!this.browser) await this.initialize();
        
        const page = await this.getAvailablePage();
        try {
            await page.goto(url, {
                waitUntil: 'load',
                timeout: 30000
            });

            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });

            return pdf;
        } finally {
            await this.releasePage(page);
        }
    }

    async disconnect(): Promise<void> {
        await this.mutex.runExclusive(async () => {
            if (this.browser) {
                await Promise.all(this.pages.map(p => p.page.close()));
                await this.browser.close();
                this.browser = null;
                this.pages = [];
                logger.info('Browser disconnected');
            }
        });
    }
}