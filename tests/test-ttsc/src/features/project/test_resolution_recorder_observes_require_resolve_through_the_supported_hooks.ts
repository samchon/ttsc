import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { RuntimeLoaderCapabilities } from "../../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities.js";

/**
 * Verifies the shared resolution recorder records a `require.resolve` a config
 * makes, wrapping no private loader slot where the hooks already see it.
 *
 * The banner and strip config loaders each replaced `Module._resolveFilename`
 * to record resolutions a resolve hook missed (samchon/ttsc#1523). A resolve
 * hook sees every `import` and `require()`; only `require.resolve` bypasses it,
 * and only on some releases. The recorder now registers the hook and, where the
 * runtime's own probe finds `require.resolve` bypassing it, records that one
 * entry point too.
 *
 * 1. In a child process, create a recorder and let it observe resolutions.
 * 2. Resolve a present file and a missing candidate through `require.resolve`.
 * 3. Assert the present file is an input with its content, the missing one an
 *    input proven absent, and the resolver was wrapped exactly where
 *    `require.resolve` does not consult the hooks.
 */
export const test_resolution_recorder_observes_require_resolve_through_the_supported_hooks =
  () => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-recorder-require-resolve-"),
    );
    fs.writeFileSync(path.join(root, "present.js"), "module.exports = 1;\n");
    const recorder = path.resolve(
      import.meta.dirname,
      "../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs",
    );
    const script = [
      `const Module = require("node:module");`,
      `const path = require("node:path");`,
      `const { createResolutionInputRecorder, observeResolutions } = require(${JSON.stringify(recorder)});`,
      `const recorder = createResolutionInputRecorder({ extensions: [".js", ".json"] });`,
      `const before = Module._resolveFilename;`,
      `observeResolutions(recorder);`,
      `const wrapped = Module._resolveFilename !== before;`,
      `const resolve = Module.createRequire(path.join(${JSON.stringify(root)}, "config.js")).resolve;`,
      `resolve("./present.js");`,
      `try { resolve("./later.js"); } catch {}`,
      `const { hashes } = recorder.finish();`,
      `process.stdout.write(JSON.stringify({ hashes, wrapped }));`,
    ].join("\n");
    const result = child_process.spawnSync(process.execPath, ["-e", script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    const { hashes, wrapped } = JSON.parse(result.stdout) as {
      hashes: Record<string, string | null>;
      wrapped: boolean;
    };
    assert.equal(
      typeof hashes[path.join(root, "present.js")],
      "string",
      "the resolved file is an input with its content",
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        hashes,
        path.join(root, "later.js"),
      ) && hashes[path.join(root, "later.js")] === null,
      "the missing candidate is an input proven absent",
    );
    assert.equal(
      wrapped,
      !RuntimeLoaderCapabilities.requireResolveConsultsHooks(),
    );
  };
