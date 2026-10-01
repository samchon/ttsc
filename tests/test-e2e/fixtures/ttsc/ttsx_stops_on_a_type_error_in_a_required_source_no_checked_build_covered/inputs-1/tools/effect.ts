declare const require: (id: "node:fs") => {
  writeFileSync(file: string, text: string): void;
};
declare const process: { env: Record<string, string | undefined> };
const count: number = "not a number";
require("node:fs").writeFileSync(process.env.TTSX_ROOT_MARKER!, String(count));
export {};
