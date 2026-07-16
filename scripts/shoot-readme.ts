// Captures README screenshots against the local dev server using a minted
// session cookie (JWT, signed with this app's own AUTH_SECRET).
// Deps (not saved): npm i --no-save tsx playwright-core
// Run: npx dotenv -e .env -- npx tsx scripts/shoot-readme.ts
import { mkdirSync } from "node:fs";

import { encode } from "next-auth/jwt";
import { chromium } from "playwright-core";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const BASE = "http://localhost:3000";
const EMAIL = "test@balancr.dev";
const OUT = "docs";

const SHOTS: { path: string; file: string; fullPage: boolean }[] = [
  { path: "/dashboard", file: "overview.png", fullPage: true },
  { path: "/dashboard/accounts", file: "accounts.png", fullPage: false },
  { path: "/dashboard/transactions", file: "transactions.png", fullPage: false },
  { path: "/dashboard/budgets", file: "budgets.png", fullPage: false },
];

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const user = await db.user.findUnique({ where: { email: EMAIL } });
  await db.$disconnect();
  if (!user) throw new Error("test user not found");

  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET missing");

  const cookieName = "authjs.session-token";
  const token = await encode({
    token: { sub: user.id, id: user.id, email: user.email, name: user.name },
    secret,
    salt: cookieName,
    maxAge: 60 * 60,
  });

  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    {
      name: cookieName,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await context.addInitScript(() => {
    window.localStorage.setItem("theme", "dark");
  });

  mkdirSync(OUT, { recursive: true });
  const page = await context.newPage();
  for (const shot of SHOTS) {
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800); // let chart animations settle
    await page.screenshot({ path: `${OUT}/${shot.file}`, fullPage: shot.fullPage });
    console.log(`captured ${shot.file}`);
  }

  await browser.close();
}

main();
