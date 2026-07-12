// Start an ngrok tunnel to the local dev server on the reserved static
// domain, so Plaid can reach /api/plaid/webhook. The domain is derived
// from APP_URL, so there is one source of truth and the webhook URL
// registered at link time always matches the tunnel.
//
//   npm run tunnel                  # uses APP_URL from .env
//   npm run tunnel -- --port 3001   # override the local port
//   PROD=1 npm run tunnel           # use .env.production.local instead

import { spawn } from "node:child_process";
import { config } from "dotenv";

const envFile = process.env.PROD ? ".env.production.local" : ".env";
config({ path: envFile });

const portArgIndex = process.argv.indexOf("--port");
const port = portArgIndex !== -1 ? process.argv[portArgIndex + 1] : "3000";

const appUrl = process.env.APP_URL;
if (!appUrl) {
  console.error(
    `APP_URL is not set in ${envFile}. Set it to your reserved ngrok URL, e.g.\n  APP_URL="https://your-name.ngrok-free.dev"`
  );
  process.exit(1);
}

let domain;
try {
  domain = new URL(appUrl).host;
} catch {
  console.error(`APP_URL in ${envFile} is not a valid URL: ${appUrl}`);
  process.exit(1);
}

console.log(`Tunneling ${domain} -> http://localhost:${port}`);
console.log(`Webhook endpoint: ${appUrl.replace(/\/$/, "")}/api/plaid/webhook\n`);

const child = spawn(
  "ngrok",
  ["http", port, `--url=${domain}`],
  { stdio: "inherit", shell: true }
);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
