import puppeteer, { Browser, Page } from 'puppeteer-core';
import { logger } from './logger';

export class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;
    private pagePool: Page[] = [];
    private readonly poolSize = 10; // Configurable pool size
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
        await page.setViewport({
            width: 1920,
            height: 1080,
            deviceScaleFactor: 1
        });
        return page;
    }

    private async initializePagePool(): Promise<void> {
        logger.info(`Initializing page pool with size ${this.poolSize}`);
        for (let i = 0; i < this.poolSize; i++) {
            const page = await this.createPage();
            this.pagePool.push(page);
        }
    }

    private async acquirePage(): Promise<Page> {
        if (this.pagePool.length > 0) {
            return this.pagePool.pop()!;
        }
        logger.warn('Page pool exhausted, creating new page');
        return this.createPage();
    }

    private async releasePage(page: Page): Promise<void> {
        if (this.pagePool.length < this.poolSize) {
            // Reset page state if needed
            await page.goto('about:blank');
            this.pagePool.push(page);
        } else {
            await page.close();
        }
    }

    async initialize(): Promise<void> {
        try {
            if (!this.browser) {
                this.browser = await puppeteer.connect({
                    browserWSEndpoint: this.browserWSEndpoint
                });
                await this.initializePagePool();
                logger.info('Browser connected and pool initialized successfully');
            }
        } catch (error) {
            logger.error('Error initializing browser:', error);
            throw error;
        }
    }

    async capturePDF(url: string): Promise<Uint8Array> {
        try {
            if (!this.browser) {
                await this.initialize();
            }

            const page = await this.acquirePage();
            
            try {
                // Navigate to URL
                await page.goto(url, {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                // Generate PDF
                const pdf = await page.pdf({
                    format: 'A4',
                    printBackground: true,
                    margin: {
                        top: '20px',
                        right: '20px',
                        bottom: '20px',
                        left: '20px'
                    }
                });

                logger.info('PDF captured successfully');
                return pdf;
            } finally {
                // Always release the page back to the pool
                await this.releasePage(page);
            }
        } catch (error) {
            logger.error('Error capturing PDF:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.browser) {
            // Close all pages in the pool
            while (this.pagePool.length > 0) {
                const page = this.pagePool.pop();
                if (page) await page.close();
            }
            await this.browser.close();
            this.browser = null;
            logger.info('Browser disconnected successfully');
        }
    }
}
