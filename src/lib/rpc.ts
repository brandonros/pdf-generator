import { Request, Response } from 'express';
import { BrowserPool } from './browser';
import { logger } from './logger';
import retry from 'async-retry';

interface RPCRequest {
    method: string;
    params: any;
    id: string | number;
}

export class RPCHandler {
    private static instance: RPCHandler;

    private constructor() {}

    public static getInstance(): RPCHandler {
        if (!RPCHandler.instance) {
            RPCHandler.instance = new RPCHandler();
        }
        return RPCHandler.instance;
    }

    async handleRequest(req: Request, res: Response) {
        const { method, params, id } = req.body as RPCRequest;
        try {
            switch (method) {
                case 'generatePdf': {
                    const pdf = await retry(
                        async () => {
                            const browserPool = BrowserPool.getInstance();
                            return (await browserPool.capturePDF(params.url));
                        },
                        {
                            retries: 2,
                            minTimeout: 0,
                            maxTimeout: 0,
                            onRetry: (error: any, attempt: number) => {
                                logger.warn({
                                    message: 'PDF generation failed, retrying',
                                    attempt,
                                    error: error.message,
                                    url: params.url
                                });
                            }
                        }
                    );
                    res.json({
                        jsonrpc: '2.0',
                        result: Buffer.from(pdf).toString('base64'),
                        id
                    });
                    break;
                }
                default: {
                    throw new Error(`Unknown method: ${method}`);
                }
            }
        } catch (error) {
            logger.error({
                error: error.message,
            });
            res.json({
                jsonrpc: '2.0',
                error: {
                    code: -32603,
                    message: error.message
                },
                id
            });
        }
    }
}
