import tailwindcss from "@tailwindcss/vite";
import ttsc from "@ttsc/unplugin/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { defineConfig } from "vite";

const environment = path.resolve(import.meta.dirname, ".env");
if (fs.existsSync(environment)) process.loadEnvFile(environment);

const port = Number(process.env.VITE_DEV_PORT ?? 5173);
if (Number.isInteger(port) === false || port < 1 || port > 65_535)
  throw new Error("VITE_DEV_PORT must be an integer from 1 to 65535.");

export default defineConfig({
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
});
