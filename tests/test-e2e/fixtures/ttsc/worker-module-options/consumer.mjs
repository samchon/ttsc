import assert from "node:assert/strict";
import path from "node:path";

const { TtscCompiler } = await import(process.env.TTSC_WORKER_PACKAGE_ENTRY);
const context = {
  cwd: process.cwd(),
  cacheDir: process.env.TTSC_WORKER_CACHE_DIR,
  plugins: false,
};
const success = await new TtscCompiler(context).transformAsync();
assert.equal(success.type, "success", JSON.stringify(success));
assert.match(success.typescript["src/main.ts"], /workerMarker/);
assert.match(success.typescript["src/main.ts"], /["']worker-module-ok["']/);

const missing = path.join(process.cwd(), "missing-worker-config.json");
const failure = await new TtscCompiler({ ...context, tsconfig: missing }).transformAsync();
assert.equal(failure.type, "exception", JSON.stringify(failure));
assert.equal(failure.error.message, `ttsc: tsconfig not found: ${missing}`);
assert.notEqual(failure.error.code, "ERR_INPUT_TYPE_NOT_ALLOWED");
console.log(JSON.stringify({ success: success.type, failure: failure.type }));
