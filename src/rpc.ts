import { Request, Response } from 'express';
import { BrowserPool } from './browser';
import { logger } from './logger';

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
                    const browserPool = BrowserPool.getInstance();
                    const pdf = await browserPool.capturePDF(params.url);
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
