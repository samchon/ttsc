declare const require: (id: string) => any;
declare const process: { cwd(): string; env: Record<string, string | undefined> };
const fs = require("node:fs");
const path = require("node:path");
const file: string = path.join(process.cwd(), "generated", "value.ts");
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, process.env.GENERATED_SOURCE!);
console.log("value=" + require(file).value);
export {};
