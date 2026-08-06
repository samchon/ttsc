import tailwindcss from "@tailwindcss/vite";
import ttsc from "@ttsc/unplugin/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { defineConfig, type UserConfig } from "vite";

const environment = path.resolve(import.meta.dirname, ".env");
if (fs.existsSync(environment)) process.loadEnvFile(environment);

const port = Number(process.env.VITE_DEV_PORT ?? 5173);
if (Number.isInteger(port) === false || port < 1 || port > 65_535)
  throw new Error("VITE_DEV_PORT must be an integer from 1 to 65535.");

const configuration: UserConfig = {
  cacheDir: path.resolve(__dirname, "../../.build-cache/vite"),
  plugins: [tailwindcss(), react(), ttsc()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "127.0.0.1",
    port,
    strictPort: true,
  },
};

/**
 * The `contract` mode is the simulated one, and the mode decides it.
 *
 * Vite lets `process.env` win over every `.env*` file, and the eager
 * `loadEnvFile` above promotes a workspace `.env` into `process.env` before that
 * resolution happens. A mode expressed as an env file would therefore be
 * overridden by any `.env` a cell wrote for an unrelated reason, silently, and
 * the contract suite would build live while every document called it simulated.
 * Setting it here puts the decision where the command already is: `--mode
 * contract` is simulated, everything else is live, and no file can disagree.
 */
export default defineConfig(({ mode }) => {
  if (mode === "contract") process.env.VITE_API_SIMULATE = "true";
  return configuration;
});
