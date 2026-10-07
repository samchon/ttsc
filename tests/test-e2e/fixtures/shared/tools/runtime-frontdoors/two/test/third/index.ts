declare function describe(name: string, body: () => void): void;
declare function it(name: string, body: () => void): void;
declare function require(name: string): any;
declare const process: { env: Record<string, string> };
enum Expected { Value = "two" }
describe("third", () => it("uses the checked emit", () => {
  if (Expected.Value !== "two") throw new Error("wrong value");
  const fs = require("node:fs"), path = require("node:path");
  if (fs.readdirSync(path.join(process.env.TTSC_CACHE_DIR, "ttsx/project")).length !== 3) throw new Error("expected three roots in the shared workspace cache");
}));
