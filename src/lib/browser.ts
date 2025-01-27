import puppeteerCore, { PDFOptions } from 'puppeteer-core';
import { Cluster } from 'puppeteer-cluster';

export class BrowserPool {
    private static instance: BrowserPool;
    private cluster: Cluster | null;

    private constructor() {
        this.cluster = null;
    }

    public static getInstance(): BrowserPool {
        if (!BrowserPool.instance) {
            BrowserPool.instance = new BrowserPool();
        }
        return BrowserPool.instance;
    }

    async initialize() {
        const clusterOptions = {
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: process.env.MAX_CONCURRENCY ? parseInt(process.env.MAX_CONCURRENCY) : 10,
            timeout: 30000,
            retryLimit: 3,
            retryDelay: 1000,
            monitor: false,
            puppeteer: puppeteerCore,
            puppeteerOptions: {
                executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
                //executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox',
                    "--font-render-hinting=none",
                    "--disable-blink-features=LayoutNGPrinting",
                    "--disable-dev-shm-usage",
                ],
            },
        }
        this.cluster = await Cluster.launch(clusterOptions);
    }

    async capturePDF(url: string, pdfOptions: PDFOptions): Promise<Uint8Array> {
        if (!this.cluster) {
            throw new Error('Browser cluster not initialized');
        }
        return this.cluster.execute(async ({ page }) => {
            await page.goto(url, {
                waitUntil: 'load', // TODO: networkidle0
                timeout: 30000,
            });
            const pdf = await page.pdf(pdfOptions);
            return pdf;
        });
    }
}
