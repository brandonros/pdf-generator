process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { Server } from "./lib/server";
import { BrowserPool } from "./lib/browser";
import { logger } from './lib/logger';

const main = async  () => {
  try {
    // initialize browser
    await BrowserPool.getInstance().initialize();

    // start server
    const server = Server.getInstance();
    await server.start();
  } catch (err) {
    logger.error(err.message);
    process.exit(1);
  }
}

main();
