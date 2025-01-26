import puppeteer, { Browser, Page } from 'puppeteer-core';
import { logger } from './logger';

export class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;

    private constructor() {}

    public static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    async connect(): Promise<void> {
        try {
            // Launch browser if not already connected
            if (!this.browser) {
                this.browser = await puppeteer.connect({
                    browserWSEndpoint: 'wss://chromium.debian-k3s'
                });
                logger.info('Browser connected successfully');
            }
        } catch (error) {
            logger.error('Error connecting to browser:', error);
            throw error;
        }
    }

    async capturePDF(url: string): Promise<Uint8Array> {
        try {
            if (!this.browser) {
                await this.connect();
            }

            // Create new page
            const page = await this.browser!.newPage();
            
            // Set viewport
            await page.setViewport({
                width: 1920,
                height: 1080,
                deviceScaleFactor: 1
            });

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

            // Close page
            await page.close();
            
            logger.info('PDF captured successfully');

            return pdf;
        } catch (error) {
            logger.error('Error capturing PDF:', error);
            throw error;
        }
    }

    async disconnect(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            logger.info('Browser disconnected successfully');
        }
    }
}
