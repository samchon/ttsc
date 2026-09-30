import { TestProject } from "@ttsc/testing";

import { SHARED_GO_BUILD_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  copyProject,
  fs,
  goPath,
  path,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies plugin corpus: a Go source plugin that delegates project emit back
 * through driver.EmitWithPluginTransformers preserves every tsgo output lane.
 *
 * This is the typia-shaped path: ttsc discovers and builds a native Go source
 * plugin, the plugin loads the consumer project with the driver API, then emits
 * via EmitWithPluginTransformers. The transformed JavaScript must not come at
 * the cost of dropping declaration artifacts.
 *
 * 1. Copy the `go-driver-emit-plugin` fixture, which enables declaration,
 *    declarationMap, sourceMap, and noEmitOnError. Its transform creates a
 *    standalone-factory member access inside a generated arrow.
 * 2. Run `ttsc --emit` so the source plugin is built and executes its own
 *    driver.EmitWithPluginTransformers build.
 * 3. Assert `.js`, `.js.map`, `.d.ts`, and `.d.ts.map` all exist, the JS is
 *    transformed, and the declaration map points back at `src/main.ts`.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises a cold driver-backed native host compiling and executing its transformed output; requires a real source-build log; JS, JS map, declaration and declaration map; native output manifest; generated member access; executed value; and declaration/map contents, distinguishing discarded emit diagnostics or incomplete native publication from valid transformed output.
 * @evidence contracts/testing.md#independent-expectations Compiler declaration semantics and the fixture's literal transform establish required TS4094 failure or generated output; executable and declaration/map expectations are written independently of the launcher result.
 * @evidence contracts/testing.md#distinguishing-cases This case pins a standalone-factory transform must preserve executable meaning and every declaration/source-map output lane; the strict-host single-file case separately covers private emit provenance consumption.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_driver_emit_transform_preserves_declaration_outputs entry executes in the native corpus E2E batch against the actual source-built Go host, preserving the original fixture/assertion ownership.
 * @evidence contracts/e2e.md#necessary-boundary The native fixture calls driver.EmitWithPluginTransformers and publishes through a real filesystem writer; only the real source-plugin loader/host connection can reveal failed assembly or discarded native diagnostics.
 * @evidence contracts/e2e.md#shared-execution This is the one cold-build assembly case for the driver-emit fixture, with an isolated plugin-artifact cache and shared Go-object cache. Other driver consumers reuse the canonical producer; the independent cold lifetime verifies that building the published Go-source integration remains viable.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each consumer has separate mutable compiler configuration and output state, while unchanged source/toolchain identity permits object reuse. Cold binary state stays isolated where asserted; TestProject owns temporary directories until process exit and each synchronous child finishes before output is inspected.
 * @evidence contracts/e2e.md#preserved-coverage Retains a real source-build log; JS, JS map, declaration and declaration map; native output manifest; generated member access; executed value; and declaration/map contents; the fixture additionally records actual successful final writes through the compiler-owned emit provenance recorder rather than deriving owners from output filenames.
 */
export function test_plugin_corpus_driver_emit_transform_preserves_declaration_outputs() {
    const root = copyProject("go-driver-emit-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-driver-emit-plugin-cache-");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
        TTSC_GO_CACHE_DIR: SHARED_GO_BUILD_CACHE_DIR,
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
      result.stderr,
      /building source plugin "go-driver-emit-plugin"/,
    );

    for (const rel of [
      "dist/main.js",
      "dist/main.js.map",
      "dist/main.d.ts",
      "dist/main.d.ts.map",
    ]) {
      assert.ok(fs.existsSync(path.join(root, rel)), `${rel} was not emitted`);
    }

    const manifest: string[] = JSON.parse(
      fs.readFileSync(path.join(root, "manifest.json"), "utf8"),
    );
    assert.ok(manifest.some((file) => file.endsWith("main.d.ts")));

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /GO DRIVER EMIT PLUGIN/);
    assert.match(js, /input => input\.value/);
    assert.match(js, /\/\/# sourceMappingURL=main\.js\.map/);

    const executed = spawn(
      process.execPath,
      [path.join(root, "dist", "main.js")],
      {
        cwd: root,
      },
    );
    assert.equal(executed.status, 0, executed.stderr);
    assert.equal(executed.stdout.trim(), "GO DRIVER EMIT PLUGIN");

    const dts = fs.readFileSync(path.join(root, "dist", "main.d.ts"), "utf8");
    assert.match(dts, /export interface Payload/);
    assert.match(dts, /export declare const payload: Payload;/);
    assert.match(dts, /\/\/# sourceMappingURL=main\.d\.ts\.map/);

    const dtsMap = JSON.parse(
      fs.readFileSync(path.join(root, "dist", "main.d.ts.map"), "utf8"),
    ) as {
      version?: number;
      sources?: string[];
      mappings?: string;
    };
    assert.equal(dtsMap.version, 3);
    assert.ok(dtsMap.mappings && dtsMap.mappings.length > 0);
    assert.ok(
      (dtsMap.sources ?? []).some((source) =>
        source.replace(/\\/g, "/").endsWith("src/main.ts"),
      ),
      `declaration map sources did not include src/main.ts: ${JSON.stringify(
        dtsMap.sources,
      )}`,
    );
}
