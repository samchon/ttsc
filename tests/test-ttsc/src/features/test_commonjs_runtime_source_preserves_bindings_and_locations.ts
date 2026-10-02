import assert from "node:assert/strict";
import { createRequire, SourceMap } from "node:module";
import path from "node:path";
import vm from "node:vm";

import { CommonJsRuntimeSource } from "../../../../packages/ttsc/src/launcher/internal/runtime/CommonJsRuntimeSource";

/**
 * Verifies owned CommonJS adaptation preserves binding, directive and map semantics.
 *
 * A prefix can silently remove strict mode or move stack columns. The function
 * must also preserve native cache identity without advertising extensions globally.
 *
 * 1. Evaluate strict, sloppy, escaped-directive, hashbang and hoisted-binding bodies.
 * 2. Compare local registry/cache behavior with the unchanged original require.
 * 3. Decode a shifted compiler map and verify its original source coordinates.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls CommonJsRuntimeSource.prepare and executes adapted bodies, verifying strictness, user bindings, owned require metadata and decoded source-map positions.
 * @evidence contracts/testing.md#independent-expectations Literal strict/sloppy return values and SourceMap original coordinates establish expected behavior; the unchanged native require extension table is snapshotted before adaptation.
 * @evidence contracts/testing.md#distinguishing-cases A custom directive before and after "use strict", an escaped `use\x20strict` (not a directive, so sloppy), a hashbang before a strict body, a hashbang-only file, four hashbang line terminators (CR, CRLF, U+2028, U+2029), a top-level return, a hoisted `function require`, a parameter named `require`, and map entries at the first column, the adjacent column and the next line distinguish semantic preservation from a bootstrap that changes strictness, line layout or a user's own binding.
 * @evidence contracts/testing.md#execution-ownership Executes authored source adaptation, Node VM and source-map decoding in one unit process without native compilation; only the owned require table is exposed and the native extension snapshot must remain unchanged.
 */
export function test_commonjs_runtime_source_preserves_bindings_and_locations(): void {
  const native = createRequire(import.meta.url);
  const extensions = { ...native.extensions };
  const filename = path.resolve("owned-commonjs-test.cjs");
  const evaluate = (source: string): unknown => {
    let prepared = CommonJsRuntimeSource.prepare(source, filename);
    if (prepared.startsWith("#!")) {
      const newline = /\r\n|[\r\n\u2028\u2029]/.exec(prepared);
      prepared = newline === null ? "" : prepared.slice(newline.index + newline[0].length);
    }
    const body = vm.runInThisContext(`(function(exports,require,module,__filename,__dirname){${prepared}\n})`, { filename });
    const module = { exports: {} };
    body.call(module.exports, module.exports, native, module, filename, path.dirname(filename));
    return module.exports;
  };
  assert.equal(evaluate('"custom";"use strict";module.exports=(function(){return this;})();'), undefined);
  assert.equal(evaluate('"use strict";"custom";module.exports=(function(){return this;})();'), undefined);
  assert.equal(evaluate('"custom";module.exports=(function(){return this===globalThis;})();'), true);
  assert.equal(evaluate('"use\\x20strict";module.exports=(function(){return this===globalThis;})();'), true);
  assert.equal(evaluate('#!/usr/bin/env node\n"use strict";module.exports=(function(){return this;})();'), undefined);
  assert.deepEqual(evaluate('#!/usr/bin/env node'), {});
  for (const separator of ["\r", "\r\n", "\u2028", "\u2029"])
    assert.equal(evaluate('#!/usr/bin/env node' + separator + '"use strict";module.exports=(function(){return this;})();'), undefined);
  assert.equal(evaluate('module.exports=7;return;'), 7);
  assert.equal(evaluate('function require(){return 73;}module.exports=require();'), 73);
  assert.equal(evaluate('module.exports=(function(require){return require;})(19);'), 19);
  assert.deepEqual(evaluate('module.exports=[require.extensions[".ts"]===require.extensions[".js"],require.cache===require("node:module").createRequire(__filename).cache,require.resolve("node:fs")];'), [true, true, "node:fs"]);
  assert.deepEqual({ ...native.extensions }, extensions);

  const original = { version: 3, names: [], sources: ["original.ts"], mappings: "AAAA,CAAC;AACA" };
  const source = 'module.exports=1;\n//# sourceMappingURL=data:application/json;base64,' + Buffer.from(JSON.stringify(original)).toString("base64");
  const prepared = CommonJsRuntimeSource.prepare(source, filename);
  const marker = "//# sourceMappingURL=data:application/json;base64,";
  const payload = JSON.parse(Buffer.from(prepared.slice(prepared.lastIndexOf(marker) + marker.length), "base64").toString("utf8"));
  const map = new SourceMap(payload);
  const column = prepared.indexOf("module.exports=1;");
  const first = map.findEntry(0, column);
  const second = map.findEntry(0, column + 1);
  const nextLine = map.findEntry(1, 0);
  assert.ok("originalColumn" in first, "first emitted column must have a source mapping");
  assert.ok("originalColumn" in second, "adjacent emitted column must have a source mapping");
  assert.ok("originalLine" in nextLine, "next emitted line must have a source mapping");
  assert.equal(first.originalColumn, 0);
  assert.equal(second.originalColumn, 1);
  assert.equal(nextLine.originalLine, 1);
}
