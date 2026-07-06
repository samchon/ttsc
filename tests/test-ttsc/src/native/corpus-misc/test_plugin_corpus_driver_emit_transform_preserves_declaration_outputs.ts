import { TestProject } from "@ttsc/testing";

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
 *    declarationMap, and sourceMap.
 * 2. Run `ttsc --emit` so the source plugin is built and executes its own
 *    driver.EmitWithPluginTransformers build.
 * 3. Assert `.js`, `.js.map`, `.d.ts`, and `.d.ts.map` all exist, the JS is
 *    transformed, and the declaration map points back at `src/main.ts`.
 */
export const test_plugin_corpus_driver_emit_transform_preserves_declaration_outputs =
  () => {
    const root = copyProject("go-driver-emit-plugin");
    const cacheDir = TestProject.tmpdir("ttsc-driver-emit-plugin-cache-");
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: cacheDir,
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

    const js = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(js, /GO DRIVER EMIT PLUGIN/);
    assert.match(js, /\/\/# sourceMappingURL=main\.js\.map/);

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
  };
