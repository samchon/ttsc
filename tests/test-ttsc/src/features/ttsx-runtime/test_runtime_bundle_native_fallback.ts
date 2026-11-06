import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { EmitOwnershipIndex } from "../../../../../packages/ttsc/src/compiler/internal/EmitOwnershipIndex";
import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { RuntimeEmitBundle } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeEmitBundle";
import { inlineServedSourceMap } from "../../../../../packages/ttsc/src/launcher/internal/inlineServedSourceMap";

/**
 * Verifies completed emit reuse preserves native source-map lookup and authored
 * output names that collide with the private runtime artifact.
 *
 * 1. Emit actual alias/external maps and private-name output collisions.
 * 2. Restore each completion into a fresh run with bundle optimization enabled.
 * 3. Compare served maps to native reads and require one producer invocation.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual cache restoration and ownership reads preserve native map text, output bytes and provenance while a producer-call assertion proves representation fallback still skips compilation.
 * @evidence contracts/testing.md#independent-expectations Authored text, direct native map reads and a native inode comparison establish map and alias expectations; stored metadata is not the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Canonical sibling maps retain bundles; map filename aliases and external references retain physical output, including native case-sensitive misses. Exact, descendant and native-case-alias artifact collisions contrast safe distinct spellings.
 * @evidence contracts/testing.md#execution-ownership The named unit calls maintained cache/index/map owners over private portable files with no installer, compiler, host or foreign-method substitution; the function removes its root after all synchronous readers finish.
 */
export function test_runtime_bundle_native_fallback(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsx-native-fallback-"));
  const failures: unknown[] = [];
  try {
    const source = path.join(root, "source.ts");
    fs.writeFileSync(source, "export const value = 7;");
    const map = JSON.stringify({
      version: 3,
      sources: [source],
      names: [],
      mappings: "AAAA",
    });
    const external = path.join(root, "external.map");
    fs.writeFileSync(external, map);
    const probe = path.join(root, RuntimeEmitBundle.filename);
    const aliasName = RuntimeEmitBundle.filename.toUpperCase();
    fs.writeFileSync(probe, "native identity probe");
    let alias = false;
    try {
      alias =
        fs.statSync(path.join(root, aliasName), { bigint: true }).ino ===
        fs.statSync(probe, { bigint: true }).ino;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    fs.unlinkSync(probe);
    const nativeRead = (file: string): string | null => {
      try {
        return fs.readFileSync(file, "utf8");
      } catch {
        return null;
      }
    };
    const cases: [string, string, [string, string][], boolean][] = [
      ["canonical", "main.js.map", [["main.js.map", map]], true],
      ["map-alias", "CUSTOM.MAP", [["custom.map", map]], false],
      ["external", external, [], false],
      [
        "reserved",
        "",
        [[RuntimeEmitBundle.filename, "compiler output"]],
        false,
      ],
      [
        "reserved-parent",
        "",
        [
          [
            path.join(RuntimeEmitBundle.filename, "nested.bin"),
            "nested output",
          ],
        ],
        false,
      ],
      ["reserved-alias", "", [[aliasName, "compiler alias output"]], !alias],
    ];
    for (const [name, url, extras, bundled] of cases) {
      try {
        const text =
          "exports.value = 7;" + (url ? "\n//# sourceMappingURL=" + url : "");
        let builds = 0;
        const run = (phase: string) => {
          const emitDir = path.join(root, name, phase);
          fs.mkdirSync(emitDir, { recursive: true });
          const emitted = path.join(emitDir, "main.js");
          const result = RuntimeBuildCache.run({
            directory: path.join(root, name, "cache"),
            emitDir,
            bundle: true,
            capture: () => "stable",
            admit: () => true,
            build: () => {
              builds++;
              for (const [relative, bytes] of [["main.js", text], ...extras]) {
                const file = path.join(emitDir, relative!);
                fs.mkdirSync(path.dirname(file), { recursive: true });
                fs.writeFileSync(file, bytes!);
              }
              return {
                status: 0,
                stdout: "",
                stderr: "",
                diagnostics: [],
                emittedSources: { [emitted]: [fs.realpathSync.native(source)] },
              };
            },
          });
          return { emitDir, emitted, result };
        };
        const cold = run("cold");
        const expected = inlineServedSourceMap(
          text,
          cold.emitted,
          source,
          nativeRead,
        );
        const warm = run("warm");
        assert.equal(builds, 1, name);
        assert.equal(warm.result.bundledOutputs === true, bundled, name);
        const index = new EmitOwnershipIndex({
          emitDir: warm.emitDir,
          rootDir: root,
          bundledOutputs: warm.result.bundledOutputs,
          emittedSources: warm.result.emittedSources,
          outputs: EmitOwnershipIndex.listOutputs(warm.emitDir, bundled),
        });
        const output = index.find(source)!;
        assert.equal(index.readOutput(output), text, name);
        assert.equal(
          inlineServedSourceMap(text, output, source, (file) =>
            index.readOutput(file),
          ),
          expected,
          name,
        );
        for (const [relative, bytes] of extras)
          assert.equal(
            index.readOutput(path.join(warm.emitDir, relative)),
            bytes,
            name,
          );
      } catch (error) {
        failures.push(new Error(name, { cause: error }));
      }
    }
  } finally {
    fs.rmSync(root, { recursive: true });
  }
  if (failures.length)
    throw new AggregateError(failures, "native restoration fallback failed");
}
