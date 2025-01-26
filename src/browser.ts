import puppeteer, { Browser, Page } from 'puppeteer-core';
import { logger } from './logger';

interface PooledPage {
    page: Page;
    inUse: boolean;
    lastUsed: number;
    id: string; // Added for tracking
}

export class BrowserPool {
    private static instance: BrowserPool;
    private browser: Browser | null = null;
    private pool: PooledPage[] = [];
    private connecting = false;
    private keepaliveInterval: NodeJS.Timeout | null = null;
    
    private readonly POOL_SIZE = 10;
    private readonly MAX_WAIT_MS = 5000;
    private readonly browserWSEndpoint: string;

    private constructor(browserWSEndpoint: string) {
        this.browserWSEndpoint = browserWSEndpoint;
        logger.info(`BrowserPool created with endpoint: ${browserWSEndpoint}`);
    }

    public static getInstance(): BrowserPool {
        if (!BrowserPool.instance) {
            //BrowserPool.instance = new BrowserPool('wss://chromium.debian-k3s');
            BrowserPool.instance = new BrowserPool('wss://informally-profound-gecko.ngrok-free.app/');
        }
        return BrowserPool.instance;
    }

    private async createPage(pageId: string): Promise<Page> {
        const startTime = performance.now();
        logger.debug(`[${pageId}] Creating new page...`);

        const page = await this.browser!.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

        page.on('close', () => {
            logger.warn(`[${pageId}] Page closed unexpectedly`);
            this.handlePageDisconnection(page, pageId);
        });

        page.on('error', (err) => {
            logger.error(`[${pageId}] Page error:`, err);
            this.handlePageDisconnection(page, pageId);
        });

        page.on('pageerror', (err) => {
            logger.error(`[${pageId}] Page error:`, err);
            this.handlePageDisconnection(page, pageId);
        });

        const duration = Math.round(performance.now() - startTime);
        logger.debug(`[${pageId}] Page created in ${duration}ms`);
        return page;
    }

    private async handlePageDisconnection(page: Page, pageId: string): Promise<void> {
        const pooledPage = this.pool.find(p => p.page === page); // TODO: why not by pageId?
        if (pooledPage) {
            logger.warn(`[${pageId}] Handling page disconnection`);
            try {
                await this.replacePage(pooledPage);
                logger.info(`[${pageId}] Successfully replaced disconnected page`);
            } catch (err) {
                logger.error(`[${pageId}] Failed to replace disconnected page:`, err);
            }
        }
    }

    private async keepAliveBrowser(): Promise<void> {
        if (!this.browser) return;
        
        try {
            // More robust health check using a test page
            const testPage = await this.browser.newPage();
            await testPage.goto('about:blank');
            await testPage.close();
            
            logger.debug('Browser keepalive check successful');
        } catch (error) {
            logger.error('Browser keepalive check failed:', error);
            await this.handleBrowserDisconnection();
        }
    }

    private startKeepalive(): void {
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
        }
        
        // Consistent 3-second interval without random delays
        this.keepaliveInterval = setInterval(async () => {
            try {
                await this.keepAliveBrowser();
            } catch (error) {
                logger.error('Keepalive interval error:', error);
            }
        }, 3000);
    }

    async initialize(): Promise<void> {
        if (this.browser || this.connecting) {
            logger.debug('Initialize called but browser already exists or connecting');
            return;
        }
        
        const startTime = performance.now();
        this.connecting = true;
        logger.info('Starting browser pool initialization...');

        try {
            this.browser = await puppeteer.connect({
                browserWSEndpoint: this.browserWSEndpoint,
                defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }
            });

            // Start keepalive interval
            this.startKeepalive();

            this.browser.on('disconnected', async () => {
                logger.error('Browser disconnected unexpectedly');
                await this.handleBrowserDisconnection();
            });

            this.browser.on('targetdestroyed', (target) => {
                logger.warn('Browser target destroyed:', target.url());
            });

            logger.debug(`Browser connected in ${Math.round(performance.now() - startTime)}ms`);

            for (let i = 0; i < this.POOL_SIZE; i++) {
                const pageId = `page_${i}`;
                const page = await this.createPage(pageId);
                this.pool.push({
                    page,
                    inUse: false,
                    lastUsed: Date.now(),
                    id: pageId
                });
            }
            
            const duration = Math.round(performance.now() - startTime);
            logger.info(`Browser pool initialized with ${this.POOL_SIZE} pages in ${duration}ms`);
        } catch (error) {
            logger.error('Failed to initialize browser pool:', error);
            throw error;
        } finally {
            this.connecting = false;
        }
    }

    private async handleBrowserDisconnection(): Promise<void> {
        // Clear keepalive interval
        if (this.keepaliveInterval) {
            clearInterval(this.keepaliveInterval);
            this.keepaliveInterval = null;
        }

        for (const pooledPage of this.pool) {
            try {
                await pooledPage.page.close().catch(() => {});
            } catch (error) {
                logger.error(`Failed to close page ${pooledPage.id}:`, error);
            }
        }

        this.browser = null;
        this.pool = [];
        this.connecting = false;
        
        try {
            await this.initialize();
            logger.info('Successfully reconnected to browser');
        } catch (error) {
            logger.error('Failed to reconnect to browser:', error);
            throw error;
        }
    }

    private async acquirePage(): Promise<Page> {
        const startTime = performance.now();
        logger.debug('Attempting to acquire page...');
        
        while (true) {
            const pooledPage = this.pool.find(p => !p.inUse);
            if (pooledPage) {
                pooledPage.inUse = true;
                pooledPage.lastUsed = Date.now();
                const duration = Math.round(performance.now() - startTime);
                logger.debug(`[${pooledPage.id}] Page acquired in ${duration}ms`);
                return pooledPage.page;
            }

            if (Date.now() - startTime > this.MAX_WAIT_MS) {
                const inUsePages = this.pool.filter(p => p.inUse).length;
                logger.error(`Timeout acquiring page. Pool status: ${inUsePages}/${this.POOL_SIZE} in use`);
                throw new Error('Timeout waiting for available page');
            }

            await new Promise(resolve => setTimeout(resolve, 50));
            logger.debug('No page available, retrying...');
        }
    }

    private async replacePage(pooledPage: PooledPage): Promise<void> {
        try {
            logger.debug(`[${pooledPage.id}] Closing page`);
            await pooledPage.page.close();
        } catch (error) {
            logger.error(`[${pooledPage.id}] Error closing broken page:`, error);
        }

        try {
            logger.debug(`[${pooledPage.id}] Creating new page`);
            const newPage = await this.createPage(pooledPage.id);
            pooledPage.page = newPage;
            pooledPage.inUse = false;
            pooledPage.lastUsed = Date.now();
        } catch (error) {
            logger.error(`[${pooledPage.id}] Error creating replacement page:`, error);
            throw error;
        }
    }

    private async releasePage(page: Page): Promise<void> {
        const startTime = performance.now();
        const pooledPage = this.pool.find(p => p.page === page);
        
        if (pooledPage) {
            logger.debug(`[${pooledPage.id}] Releasing page...`);
            try {
                await page.goto('about:blank');
                await page.reload();
                pooledPage.inUse = false;
                pooledPage.lastUsed = Date.now();
                
                const duration = Math.round(performance.now() - startTime);
                logger.debug(`[${pooledPage.id}] Page released in ${duration}ms`);
            } catch (error) {
                logger.error(`[${pooledPage.id}] Error releasing page:`, error);
                await this.replacePage(pooledPage);
            }
        }
    }

    async withPage<T>(action: (page: Page) => Promise<T>): Promise<T> {
        const startTime = performance.now();
        
        if (!this.browser) {
            logger.debug('Browser not initialized, initializing...');
            await this.initialize();
        }
        
        const page = await this.acquirePage();
        const pooledPage = this.pool.find(p => p.page === page);
        logger.info(`[${pooledPage?.id}] Starting page operation`);
        
        try {
            const result = await action(page);
            const duration = Math.round(performance.now() - startTime);
            logger.info(`[${pooledPage?.id}] Page operation completed in ${duration}ms`);
            return result;
        } catch (error) {
            logger.error(`[${pooledPage?.id}] Page operation failed:`, error);
            throw error;
        } finally {
            await this.releasePage(page);
        }
    }

    async capturePDF(url: string): Promise<Uint8Array> {
        const startTime = performance.now();
        logger.info(`Starting PDF capture`);
        
        return this.withPage(async (page) => {
            const navigationStart = performance.now();
            await page.goto(url, {
                waitUntil: 'load', // TODO: networkidle0
                timeout: 30000
            });
            logger.debug(`Navigation completed in ${Math.round(performance.now() - navigationStart)}ms`);

            const pdfStart = performance.now();
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
            });
            
            const totalDuration = Math.round(performance.now() - startTime);
            const pdfDuration = Math.round(performance.now() - pdfStart);
            logger.info(`PDF captured in ${pdfDuration}ms, total operation took ${totalDuration}ms`);
            
            return pdf;
        });
    }
}