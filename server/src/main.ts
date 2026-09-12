import "dotenv/config";
import { loadEnv } from "./config/env.js";
import { buildContainer } from "./config/container.js";
import { createApp } from "./adapters/http/express/app.js";

function main() {
  const env = loadEnv();
  const container = buildContainer(env);
  const app = createApp(container);

  app.listen(env.PORT, () => {
    console.log(`Server listening on http://localhost:${env.PORT}`);
  });
}

main();
