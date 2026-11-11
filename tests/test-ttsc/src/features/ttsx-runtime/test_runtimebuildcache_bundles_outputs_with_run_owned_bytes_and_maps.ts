import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";
import { inlineServedSourceMap } from "../../../../../packages/ttsc/src/launcher/internal/inlineServedSourceMap";

/**
 * Verifies a warm generation serves owned JS and maps without individual output
 * files and survives deletion of the persistent document that supplied it.
 *
 * 1. Publish a producer's exact JavaScript, source map and declaration bytes.
 * 2. Restore a bundled run and read its actual source-owned bytes and map.
 * 3. Delete persistent storage, corrupt a run artifact and move inputs after a
 *    lookup.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual cache and ownership index serve JS/source-map bytes from a bundled hit while per-output files are absent; persistent deletion cannot remove the run's data, corruption is rejected, and inputs that move after a hit's one proof leave that hit served without a second producer call.
 * @evidence contracts/testing.md#independent-expectations Authored JS text, a literal map source, native source identity and explicit producer-call counts determine expectations independently of stored key or bundle representation.
 * @evidence contracts/testing.md#distinguishing-cases Cold physical emit, warm bundle, persistent collection, missing bundled output, corrupt run storage and inputs moving after a lookup retain separate behavior; existing store units cover bypass, damaged persistent documents and failed publication.
 * @evidence contracts/testing.md#execution-ownership The test-ttsc runner discovers this source-unit function; portable files and maintained owners execute without a compiler or installed consumer.
 */
export function test_runtimebuildcache_bundles_outputs_with_run_owned_bytes_and_maps(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-bundled-emit-"));
  try {
    const source = path.join(root, "source.ts");
    fs.writeFileSync(source, "export const value = 7;");
    const directory = path.join(root, "cache");
    const text = "exports.value = 7;\n//# sourceMappingURL=main.js.map";
    const map = JSON.stringify({
      version: 3,
      sources: [source],
      names: [],
      mappings: "AAAA",
    });
    let builds = 0;
    const run = (name: string, moving = false) => {
      const emitDir = path.join(root, name);
      fs.mkdirSync(emitDir);
      let captures = 0;
      const result = RuntimeBuildCache.run({
        directory,
        emitDir,
        bundle: true,
        capture: () => (moving && ++captures > 1 ? "changed" : "stable"),
        admit: () => true,
        build: () => {
          builds++;
          fs.mkdirSync(path.join(emitDir, "lib"), { recursive: true });
          fs.writeFileSync(path.join(emitDir, "lib/main.js"), text);
          fs.writeFileSync(path.join(emitDir, "lib/main.js.map"), map);
          fs.writeFileSync(
            path.join(emitDir, "lib/main.d.ts"),
            "export declare const value = 7;",
          );
          return {
            status: 0,
            diagnostics: [],
            stdout: "",
            stderr: "",
            emittedSources: {
              [path.join(emitDir, "lib/main.js")]: [
                fs.realpathSync.native(source),
              ],
            },
          };
        },
      });
      return { emitDir, result };
    };
    run("cold");
    const warm = run("warm");
    assert.equal(builds, 1);
    assert.equal(fs.existsSync(path.join(warm.emitDir, "lib/main.js")), false);
    assert.equal(
      fs.existsSync(path.join(warm.emitDir, "lib/main.js.map")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(warm.emitDir, "lib/main.d.ts")),
      false,
    );
    const index = new EmitOwnershipIndex({
      emitDir: warm.emitDir,
      rootDir: root,
      bundledOutputs: warm.result.bundledOutputs,
      emittedSources: warm.result.emittedSources,
      outputs: EmitOwnershipIndex.listOutputs(
        warm.emitDir,
        warm.result.bundledOutputs === true,
      ),
    });
    const emitted = index.find(source)!;
    assert.equal(index.readOutput(emitted), text);
    assert.equal(index.readOutput(emitted + ".map"), map);
    assert.equal(
      index.readOutput(path.join(warm.emitDir, "unrecorded.js")),
      null,
    );
    const inlined = inlineServedSourceMap(text, emitted, source, (file) =>
      index.readOutput(file),
    );
    assert.match(inlined, /sourceMappingURL=data:application\/json/);
    fs.rmSync(directory, { recursive: true, force: true });
    const independent = RuntimeEmitBundle.open(warm.emitDir)!;
    assert.equal(independent.read(emitted), text);
    assert.equal(
      independent.read(path.join(warm.emitDir, "lib/main.js")),
      text,
    );
    run("cold-after-collection");
    assert.equal(builds, 2);
    // A hit proves its inputs once, when it is looked up. Restoring reads no
    // input, so inputs that move afterwards belong to the next run's proof and
    // do not turn this one into a second compile.
    const moved = run("moving", true);
    assert.equal(builds, 2);
    assert.equal(moved.result.bundledOutputs, true);
    fs.writeFileSync(
      path.join(warm.emitDir, RuntimeEmitBundle.filename),
      "invalid bundle",
    );
    assert.throws(() => RuntimeEmitBundle.open(warm.emitDir));
    const mutable = path.join(root, "mutable");
    fs.mkdirSync(mutable);
    assert.equal(
      RuntimeEmitBundle.write(mutable, [
        ["main.js", Buffer.from("exports.value = 7;").toString("base64")],
      ]),
      true,
    );
    const reader = RuntimeEmitBundle.open(mutable)!;
    const artifact = path.join(mutable, RuntimeEmitBundle.filename);
    const bytes = fs.readFileSync(artifact);
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    fs.writeFileSync(artifact, bytes);
    assert.throws(() => reader.read(path.join(mutable, "main.js")));
    assert.throws(() => RuntimeEmitBundle.open(mutable));
    fs.truncateSync(artifact, bytes.length - 1);
    assert.throws(() => reader.read(path.join(mutable, "main.js")));
    assert.throws(() => RuntimeEmitBundle.open(mutable));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
