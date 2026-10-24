import assert from "node:assert/strict";
import path from "node:path";
import ttsc from "@ttsc/unplugin/bun";
const source = path.join(process.cwd(), "index.ts");
const options = { project: "tsconfig.json", runExternalCode: true };
const built = await Bun.build({ entrypoints: [source], plugins: [ttsc(options)], format: "esm", target: "bun" });
assert.equal(built.success, true, JSON.stringify(built.logs));
const output = await built.outputs[0].text();
assert.equal((await import("data:text/javascript;base64," + Buffer.from(output).toString("base64"))).value.name, "ok");

console.log("content-mappers:bundle-passed");
