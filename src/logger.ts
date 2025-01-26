import winston from 'winston';

class Logger {
    private static instance: winston.Logger;

    private constructor() {}

    public static getInstance(): winston.Logger {
        if (!Logger.instance) {
            Logger.instance = winston.createLogger({
                level: process.env.LOG_LEVEL || 'info',
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.json()
                ),
                transports: [
                    new winston.transports.Console({
                        format: winston.format.combine(
                            winston.format.json()
                        ),
                    }),
                ],
            });
        }
        return Logger.instance;
    }
}

export const logger = Logger.getInstance();
