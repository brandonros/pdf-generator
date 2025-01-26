process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { Server } from "./server";
import { BrowserManager } from "./browser";

const main = async  () => {
  // initialize browser
  await BrowserManager.getInstance().initialize();

  // start server
  const server = Server.getInstance();
  await server.start();
}

main();
