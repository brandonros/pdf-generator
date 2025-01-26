import express, { Express } from 'express';
import { logger } from './logger';
import { RPCHandler } from './rpc';

export class Server {
    private static instance: Server;
    private app: Express;
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
        this.app.get('/api/ping', (_req, res) => res.send('pong'));
        this.app.post('/api/rpc', (req, res) => RPCHandler.getInstance().handleRequest(req, res));

        // Start the server
        await new Promise((resolve) => this.app.listen(this.port, resolve));
        logger.info(`Server is running on port ${this.port}`);
    }

    // Getter for the Express app instance if needed
    getApp(): Express {
        return this.app;
    }
}
