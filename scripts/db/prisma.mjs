import { loadEnvironment, migrate, permissions, run, fail } from "./common.mjs";
loadEnvironment();
try {
  if (!process.env.DIRECT_URL) throw new Error("DIRECT_URL is required; run npm run db:local:setup first");
  if (process.argv[2] === "deploy") {
    console.log((await migrate(process.env.DIRECT_URL)).trim());
    await permissions(process.env.DIRECT_URL, process.env.DATABASE_ROLE || "inrole_app");
    console.log("Application grants applied.");
  } else console.log((await run(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "status"])).trim());
} catch (error) { fail(error); }
