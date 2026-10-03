declare const require: (id: string) => any;
declare const process: { env: Record<string, string | undefined> };
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const manifest = JSON.parse(
  fs.readFileSync(process.env.TTSX_RUNTIME_MANIFEST!, "utf8"),
);
const source: string = fs.realpathSync.native(path.join(__dirname, "lazy.ts"));
const relative: string = path.relative(manifest.rootDir, source);
const output: string = path.join(manifest.emitDir, relative.replace(/\.ts$/, ".js"));
fs.rmSync(output);
require("./lazy");
export {};
