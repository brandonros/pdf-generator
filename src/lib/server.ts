import express from 'express';
import { logger } from './logger';
import { RPCHandler } from './rpc';

export class Server {
    private static instance: Server;
    private app: express.Application;
    private port: number;

    private constructor() {
        this.app = express();
        this.port = parseInt(process.env.PORT || '3000');
    }

    public static getInstance(): Server {
        if (!Server.instance) {
            Server.instance = new Server();
        }
        return Server.instance;
    }

    async start() {
        // Configure middleware
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Add your routes here
        this.app.get('/api/ping', (req, res) => {
            res.send('pong');
        });
        this.app.post('/api/rpc', async (req, res) => {
            await RPCHandler.getInstance().handleRequest(req, res);
        });

        // Start the server
        await new Promise((resolve) => this.app.listen(this.port, resolve));
        logger.info(`Server is running on port ${this.port}`);
    }
}
