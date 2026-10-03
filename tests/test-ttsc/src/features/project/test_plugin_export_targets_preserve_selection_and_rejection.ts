import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginPackageResolution } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginPackageResolution";

/**
 * Verifies plugin export targets select descriptors and preserve refusal codes.
 *
 * A dedicated ttsc target must not fall back to the runtime entry when it is
 * blocked, missing or outside its package. Export arrays can skip an invalid
 * target, while an array of blocked targets remains blocked.
 *
 * 1. Author ten package export maps and existing descriptor/runtime files.
 * 2. Resolve every package through the owning source operation.
 * 3. Compare all selected files and refusal codes with literal contract outcomes.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls PluginPackageResolution.resolvePluginRequest for ten export maps and checks exact canonical descriptor paths or exact refusal codes. Existing escaping files distinguish target rejection from accidental missing-file rejection; encoded-space selection must choose the decoded filename despite an existing literal-percent distractor.
 * @evidence contracts/testing.md#independent-expectations Node package exports defines blocked targets as ERR_PACKAGE_PATH_NOT_EXPORTED, absent selected files as MODULE_NOT_FOUND and escaping targets as ERR_INVALID_PACKAGE_TARGET. Pinned Node v24.18.0 esm/resolve.js resolves target strings as URLs, rejects numeric condition keys and rejects mixed subpath/condition root maps with ERR_INVALID_PACKAGE_CONFIG. The independently authored decoded filename and literal refusal codes do not use this resolver to construct expected values; no reference child is executed.
 * @evidence contracts/testing.md#distinguishing-cases Preserves valid, blocked, missing, escaping, nested blocked, invalid-first fallback and all-blocked array inputs. Encoded-space targets contrast decoded and literal-percent existing files; numeric conditions and mixed top-level maps contrast with valid condition/subpath shapes. Runtime entries exist for every row so an inappropriate fallback cannot pass. All outcomes are collected before comparison.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this matching unit feature and Evidence selects its named exported function. The authored source resolver reads call-owned fixture manifests in process, without native builds, descriptor evaluation, product hosts or reference subprocesses; finally removes the temporary tree.
 */
export function test_plugin_export_targets_preserve_selection_and_rejection(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-plugin-export-targets-")),
  );
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    const cases: Record<string, unknown> = {
      valid: { ttsc: "./descriptor.cjs", default: "./runtime.cjs" },
      blocked: { ttsc: null, default: "./runtime.cjs" },
      missing: { ttsc: "./missing.cjs", default: "./runtime.cjs" },
      escaping: { ttsc: "./../outside.cjs", default: "./runtime.cjs" },
      nested: { node: { ttsc: null, default: "./runtime.cjs" } },
      fallback: { ttsc: ["./../outside.cjs", "./descriptor.cjs"] },
      emptied: { ttsc: [null, null], default: "./runtime.cjs" },
      encoded: { ttsc: "./descriptor%20space.cjs", default: "./runtime.cjs" },
      numeric: { "0": "./runtime.cjs", ttsc: "./descriptor.cjs" },
      mixed: { ".": { ttsc: "./descriptor.cjs" }, default: "./runtime.cjs" },
    };
    fs.mkdirSync(path.join(root, "node_modules"));
    fs.writeFileSync(path.join(root, "node_modules", "outside.cjs"), "");
    for (const [name, target] of Object.entries(cases)) {
      const directory = path.join(root, "node_modules", `pkg-${name}`);
      fs.mkdirSync(directory);
      fs.writeFileSync(
        path.join(directory, "package.json"),
        JSON.stringify({
          name: `pkg-${name}`,
          exports: name === "mixed" ? target : { ".": target },
        }),
      );
      fs.writeFileSync(path.join(directory, "descriptor.cjs"), "");
      fs.writeFileSync(path.join(directory, "runtime.cjs"), "");
      if (name === "encoded") {
        fs.writeFileSync(path.join(directory, "descriptor space.cjs"), "decoded");
        fs.writeFileSync(path.join(directory, "descriptor%20space.cjs"), "literal percent distractor");
      }
    }
    const outcomes = Object.fromEntries(Object.keys(cases).map((name) => {
      try {
        return [name, `file:${PluginPackageResolution.resolvePluginRequest(`pkg-${name}`, root)}`];
      } catch (error) {
        return [name, `error:${String((error as { code?: unknown }).code)}`];
      }
    }));
    assert.deepEqual(outcomes, {
      valid: `file:${path.join(root, "node_modules", "pkg-valid", "descriptor.cjs")}`,
      blocked: "error:ERR_PACKAGE_PATH_NOT_EXPORTED",
      missing: "error:MODULE_NOT_FOUND",
      escaping: "error:ERR_INVALID_PACKAGE_TARGET",
      nested: "error:ERR_PACKAGE_PATH_NOT_EXPORTED",
      fallback: `file:${path.join(root, "node_modules", "pkg-fallback", "descriptor.cjs")}`,
      emptied: "error:ERR_PACKAGE_PATH_NOT_EXPORTED",
      encoded: `file:${path.join(root, "node_modules", "pkg-encoded", "descriptor space.cjs")}`,
      numeric: "error:ERR_INVALID_PACKAGE_CONFIG",
      mixed: "error:ERR_INVALID_PACKAGE_CONFIG",
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
