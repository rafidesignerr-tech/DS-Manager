import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./app/server/schema.ts",
  out: "./drizzle",
});
