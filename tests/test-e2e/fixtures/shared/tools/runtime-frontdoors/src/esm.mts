import { DatabaseSync } from "node:sqlite";
declare const console: { log(value: unknown): void };
const database = new DatabaseSync(":memory:");
database.close();
console.log(JSON.stringify({ kind: "esm", sqlite: "esm-sqlite-ok" }));
