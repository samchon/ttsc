import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies dependency markers select explicit bundles and refuse damaged
 * storage.
 *
 * 1. Publish a valid marked bundle and read its generation metadata.
 * 2. Corrupt, remove and replace its artifact with an ordinary JavaScript file.
 * 3. Require misses until an unmarked physical generation is explicitly selected.
 *
 * @evidence contracts/testing.md#behavioral-verification The maintained marker reader validates a real bundle and returns misses for corrupt, missing or malformed marked storage; physical storage remains independently usable without interpreting an unrelated reserved filename.
 * @evidence contracts/testing.md#independent-expectations A literal generation id, authored JavaScript and explicit true/absent/false marker variants determine expected admission without reading the bundle format or computing its checksum.
 * @evidence contracts/testing.md#distinguishing-cases Valid bundle, corrupt bundle, absent bundle with a physical JavaScript neighbor, invalid mode and ordinary unmarked output distinguish explicit representation from mere filename presence.
 * @evidence contracts/testing.md#execution-ownership The source-unit runner calls the maintained reader against an owned temporary generation with no compiler, process substitution or global environment mutation.
 */
export function test_runtimeemitbundle_dependency_markers_require_complete_storage(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-bundle-marker-"));
  try {
    const generation = "1234567890abcdef1234567890abcdef";
    const emitDir = path.join(root, `gen-${generation}`);
    fs.mkdirSync(emitDir);
    const artifact = path.join(emitDir, RuntimeEmitBundle.filename);
    const metaPath = path.join(root, "meta.json");
    const meta = {
      generation,
      rootDir: root,
      moduleOptions: { module: "commonjs" },
      outputs: ["main.js"],
      emittedSources: {
        [path.join(emitDir, "main.js")]: [path.join(root, "main.ts")],
      },
    };
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ ...meta, bundledOutputs: true }),
    );
    RuntimeEmitBundle.write(emitDir, [
      ["main.js", Buffer.from("exports.value = 7;").toString("base64")],
    ]);
    assert.equal(readDependencyCache(root, metaPath)?.bundledOutputs, true);
    fs.writeFileSync(artifact, "damaged");
    assert.equal(readDependencyCache(root, metaPath), null);
    fs.unlinkSync(artifact);
    fs.writeFileSync(path.join(emitDir, "main.js"), "exports.value = 8;");
    assert.equal(readDependencyCache(root, metaPath), null);
    fs.writeFileSync(
      metaPath,
      JSON.stringify({ ...meta, bundledOutputs: false }),
    );
    assert.equal(readDependencyCache(root, metaPath), null);
    fs.writeFileSync(artifact, "unrelated physical neighbor");
    fs.writeFileSync(metaPath, JSON.stringify(meta));
    const physical = readDependencyCache(root, metaPath)!;
    assert.equal(physical.emitDir, emitDir);
    assert.equal(Object.hasOwn(physical, "bundledOutputs"), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
