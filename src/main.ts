process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

import { Server } from "./server";

const main = async  () => {
  const server = Server.getInstance();
  await server.start();
}

main();