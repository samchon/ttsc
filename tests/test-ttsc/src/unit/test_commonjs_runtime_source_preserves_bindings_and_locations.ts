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
