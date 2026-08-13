import { defineConfig } from "drizzle-kit";

const dbFile =
  process.env.DEMO_SQLITE_PATH ?? "./data/demo.sqlite";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: dbFile,
  },
});
