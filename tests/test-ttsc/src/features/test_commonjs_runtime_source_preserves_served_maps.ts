import assert from "node:assert/strict";
import { createRequire, SourceMap } from "node:module";
import type { SourceMapPayload } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";

import { inlineServedSourceMap } from "../../../../packages/ttsc/src/launcher/internal/inlineServedSourceMap";
import { CommonJsRuntimeSource } from "../../../../packages/ttsc/src/launcher/internal/runtime/CommonJsRuntimeSource";

/**
 * Verifies compiler locations survive the actual inline-producer and CommonJS
 * runtime preparation chain.
 *
 * The runtime wrapper prepends text to emitted CommonJS, so the attached source
 * map must shift by exactly that insertion for ordinary, hashbang and indexed
 * maps, while malformed optional metadata must never reject valid JavaScript.
 *
 * 1. Inline served maps given as base64, charset base64 and percent-encoded data
 *    URIs, prepare them, and require the original sources content, a file URL
 *    source and the shifted mapped positions.
 * 2. Repeat with a hashbang line and with an indexed section map.
 * 3. Feed malformed and unsupported map payloads and require the program to still
 *    execute and return its value.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual inlineServedSourceMap and CommonJsRuntimeSource.prepare chain, decodes its emitted maps and executes valid code carrying malformed optional metadata.
 * @evidence contracts/testing.md#independent-expectations Literal original line two and adjacent columns zero and one, authored sourcesContent and independent source-file URLs establish location expectations rather than reading expected positions from a second implementation call.
 * @evidence contracts/testing.md#distinguishing-cases Base64, charset and percent-encoded maps, hashbang lines, indexed section offsets and six malformed or unavailable map shapes distinguish accurate metadata adaptation from rejecting valid JavaScript.
 * @evidence contracts/testing.md#execution-ownership Executes source-map production and adaptation with Node SourceMap and VM in one source-unit process; compiler emission, Node CLI bootstrap and product hosts are not invoked.
 */
export function test_commonjs_runtime_source_preserves_served_maps(): void {
  const filename = path.resolve("served-original.ts");
  const emitted = path.resolve("served-original.js");
  const original = {
    version: 3,
    names: [],
    sources: ["original.ts"],
    sourcesContent: ["\n\nmodule.exports = 42;"],
    mappings: "AAEA,CAAC;AACA",
  };
  const marker = "//# sourceMappingURL=data:application/json;base64,";
  const payload = (source: string): SourceMapPayload & Record<string, any> => JSON.parse(
    Buffer.from(source.slice(source.lastIndexOf(marker) + marker.length), "base64").toString("utf8"),
  );
  const encode = (map: unknown): string => Buffer.from(JSON.stringify(map)).toString("base64");
  const check = (uri: string, hashbang = ""): void => {
    const source = hashbang + 'module.exports=42;\n//# sourceMappingURL=' + uri;
    const prepared = CommonJsRuntimeSource.prepare(inlineServedSourceMap(source, emitted, filename), filename);
    const decoded = payload(prepared);
    assert.deepEqual(decoded.sourcesContent, original.sourcesContent);
    assert.deepEqual(decoded.sources, [pathToFileURL(filename).href]);
    const insertionLine = hashbang === "" ? 0 : 1;
    const column = prepared.split("\n")[insertionLine]!.indexOf("module.exports=42;");
    const mapped = new SourceMap(decoded).findEntry(insertionLine, column);
    assert.ok("originalLine" in mapped);
    assert.equal(mapped.originalLine, 2);
    assert.equal(mapped.originalColumn, 0);
    const adjacent = new SourceMap(decoded).findEntry(insertionLine, column + 1);
    assert.ok("originalColumn" in adjacent);
    assert.equal(adjacent.originalColumn, 1);
  };
  for (const uri of [
    "data:application/json;base64," + encode(original),
    "data:application/json;charset=utf-8;base64," + encode(original),
    "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(original)),
  ]) check(uri);

  const hashbangMap = { ...original, mappings: ";AAEA,CAAC;AACA" };
  const hashbangSource = '#!/usr/bin/env node\nmodule.exports=42;\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,' + encode(hashbangMap);
  const hashbangPrepared = CommonJsRuntimeSource.prepare(inlineServedSourceMap(hashbangSource, emitted, filename), filename);
  const hashbangEntry = new SourceMap(payload(hashbangPrepared)).findEntry(1, hashbangPrepared.split("\n")[1]!.indexOf("module.exports"));
  assert.ok("originalLine" in hashbangEntry);
  assert.equal(hashbangEntry.originalLine, 2);

  const indexed = { version: 3, sections: [
    { offset: { line: 0, column: 0 }, map: original },
    { offset: { line: 1, column: 0 }, map: { ...original, mappings: "AAGA" } },
  ] };
  const indexedPrepared = CommonJsRuntimeSource.prepare(inlineServedSourceMap('module.exports=42;\n\n//# sourceMappingURL=data:application/json;base64,' + encode(indexed), emitted, undefined), filename);
  const indexedPayload = payload(indexedPrepared);
  assert.equal("sources" in indexedPayload, false);
  assert.equal(indexedPayload.sections[0].offset.column, indexedPrepared.indexOf("module.exports=42;"));
  assert.equal(indexedPayload.sections[1].offset.column, 0);
  assert.equal(indexedPayload.sections[0].map.sources[0], pathToFileURL(path.resolve("original.ts")).href);
  assert.deepEqual(indexedPayload.sections[0].map.sourcesContent, original.sourcesContent);
  const indexedEntry = new SourceMap(indexedPayload).findEntry(0, indexedPrepared.indexOf("module.exports=42;"));
  assert.ok("originalLine" in indexedEntry);
  assert.equal(indexedEntry.originalLine, 2);

  const native = createRequire(import.meta.url);
  for (const map of ["!!!", encode(null), encode([]), encode({ version: 3, sections: [] }), encode({ version: 3, mappings: "!" }), encode({ version: 3, sections: [{ offset: { line: 0, column: 0 }, url: "missing.map" }] })]) {
    const source = 'module.exports=42;\n//# sourceMappingURL=data:application/json;base64,' + map;
    const prepared = CommonJsRuntimeSource.prepare(inlineServedSourceMap(source, emitted, filename), filename);
    const body = vm.runInThisContext(`(function(exports,require,module,__filename,__dirname){${prepared}\n})`, { filename });
    const module = { exports: {} };
    body(module.exports, native, module, filename, path.dirname(filename));
    assert.equal(module.exports, 42, "optional malformed or indexed metadata must not reject valid JavaScript");
  }
}
