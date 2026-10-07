declare const require: { (name: string): any; main: unknown; cache: unknown };
declare const module: unknown;
declare const __filename: string;
declare const console: { log(value: unknown): void };
const prefix = ["node:sqlite", "node:test", "node:test/reporters", "node:sea"].map((name) => require(name));
const database = new (require("node:sqlite").DatabaseSync)(":memory:");
database.close();
console.log(JSON.stringify({ main: require.main === module, cache: typeof require.cache, shared: require.cache === require("node:module").createRequire(__filename).cache, dep: require("./dep.js").value, prefix: prefix.every((value) => value !== null && value !== undefined), cryptoLength: require("node:crypto").randomUUID().length }));
export {};
