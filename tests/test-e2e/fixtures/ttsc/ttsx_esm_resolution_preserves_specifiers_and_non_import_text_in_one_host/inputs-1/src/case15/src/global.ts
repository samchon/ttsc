import path from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sourceOnly = new URL("./marker.txt", import.meta.url);
export const sourceUrl = import.meta.url;
