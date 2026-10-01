declare const __dirname: string;
declare function require<T = unknown>(name: string): T;
const fs = require<{
  mkdirSync(p: string, o: { recursive: boolean }): void;
  writeFileSync(p: string, data: string): void;
}>("node:fs");
const path = require<{ join(...parts: string[]): string }>(
  "node:path",
);

const dir = path.join(__dirname, "generated");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(
  path.join(dir, "leaf.ts"),
  "export const value: number = 42;\n",
);

const leaf = require<{ value: number }>("./generated/leaf");
console.log("VALUE:" + leaf.value);
