import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginPackageResolution } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginPackageResolution";
import { FileSystemIterator } from "../../../../utils/src/FileSystemIterator";

/**
 * Verifies plugin export targets select descriptors and preserve refusal codes.
 *
 * A dedicated ttsc target must not fall back to the runtime entry when it is
 * blocked, missing or outside its package. Export arrays can skip an invalid
 * target, while an array of blocked targets remains blocked.
 *
 * 1. Author thirteen package export maps and existing descriptor/runtime files.
 * 2. Resolve every package through the owning source operation.
 * 3. Compare all selected files and refusal codes with literal contract outcomes.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls PluginPackageResolution.resolvePluginRequest for thirteen export maps and checks exact canonical descriptor/default paths or exact refusal codes. Existing escaping files distinguish target rejection from accidental missing-file rejection; encoded-space selection must choose the decoded filename despite an existing literal-percent distractor. A dedicated condition and wildcard substitution select descriptor files beside throwing runtime files, while absent opt-in selects the default file.
 * @evidence contracts/testing.md#independent-expectations Node package exports defines blocked targets as ERR_PACKAGE_PATH_NOT_EXPORTED, absent selected files as MODULE_NOT_FOUND and escaping targets as ERR_INVALID_PACKAGE_TARGET. Pinned Node v24.18.0 esm/resolve.js resolves target strings as URLs, rejects numeric condition keys and rejects mixed subpath/condition root maps with ERR_INVALID_PACKAGE_CONFIG. The independently authored decoded filename and literal refusal codes do not use this resolver to construct expected values; no reference child is executed.
 * @evidence contracts/testing.md#distinguishing-cases Preserves valid, blocked, missing, escaping, nested blocked, invalid-first fallback and all-blocked array inputs. Encoded-space targets contrast decoded and literal-percent existing files; numeric conditions and mixed top-level maps contrast with valid condition/subpath shapes. Dedicated, patterned and missing-condition populations preserve explicit descriptor selection, substituted prefix selection and ordinary default fallback. Absolute, relative and directory-link requests must select the independently observed native physical file; missing-file fallback preserves its supplied spelling. Runtime entries exist for every row so an inappropriate fallback cannot pass. All export outcomes are collected before comparison.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this matching unit feature and Evidence selects its named exported function. The authored source resolver reads call-owned fixture manifests in process, without native builds, descriptor evaluation, product hosts or reference subprocesses; finally removes the temporary tree. Throwing runtime bytes are resolution inputs only: neither their evaluation nor descriptor execution/native transform delivery is certified.
 */
export async function test_plugin_export_targets_preserve_selection_and_rejection(): Promise<void> {
  const lexicalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-plugin-export-targets-"));
  const root = fs.realpathSync.native(lexicalRoot);
  try {
    await FileSystemIterator.write(root, {
      "package.json": "{}",
      "node_modules/outside.cjs": "",
    });
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
      barrel: { ttsc: "./descriptor.cjs", default: "./runtime.cjs" },
      pattern: {
        "./plugins/*.js": {
          ttsc: "./descriptors/*.cjs",
          default: "./runtime/*.cjs",
        },
      },
      ordinary: "./runtime.cjs",
    };
    for (const [name, target] of Object.entries(cases)) {
      const directory = path.join(root, "node_modules", `pkg-${name}`);
      await FileSystemIterator.write(directory, {
        "package.json": JSON.stringify({
          name: `pkg-${name}`,
          exports:
            name === "mixed" || name === "pattern" ? target : { ".": target },
        }),
        "descriptor.cjs":
          name === "barrel" ? 'module.exports = { name: "descriptor" };\n' : "",
        "runtime.cjs":
          name === "barrel" || name === "ordinary"
            ? 'throw new Error("TTSC_TEST_RUNTIME_BARREL_LOADED");\n'
            : "",
        ...(name === "pattern"
          ? {
              "descriptors/prefix.cjs":
                'module.exports = { name: "pattern-descriptor" };\n',
              "runtime/prefix.cjs":
                'throw new Error("TTSC_TEST_PATTERN_RUNTIME_LOADED");\n',
            }
          : {}),
        ...(name === "encoded"
          ? {
              "descriptor space.cjs": "decoded",
              "descriptor%20space.cjs": "literal percent distractor",
            }
          : {}),
      });
    }
    const descriptor = path.join(root, "node_modules/pkg-valid/descriptor.cjs");
    const physicalDescriptor = fs.realpathSync.native(descriptor);
    assert.equal(PluginPackageResolution.resolvePluginRequest(
      path.join(lexicalRoot, "node_modules/pkg-valid/descriptor.cjs"), lexicalRoot,
    ), physicalDescriptor);
    assert.equal(PluginPackageResolution.resolvePluginRequest(
      "./node_modules/pkg-valid/descriptor.cjs", lexicalRoot,
    ), physicalDescriptor);
    const alias = path.join(root, "descriptor-directory-alias");
    fs.symlinkSync(path.dirname(descriptor), alias, process.platform === "win32" ? "junction" : "dir");
    assert.equal(PluginPackageResolution.resolvePluginRequest(
      path.join(alias, "descriptor.cjs"), lexicalRoot,
    ), physicalDescriptor);
    const missing = path.join(lexicalRoot, "missing-descriptor.cjs");
    assert.equal(PluginPackageResolution.resolveRealPath(missing), missing);
    const outcomes = Object.fromEntries(
      Object.keys(cases).map((name) => {
        try {
          const request =
            name === "pattern"
              ? "pkg-pattern/plugins/prefix.js"
              : `pkg-${name}`;
          return [
            name,
            `file:${PluginPackageResolution.resolvePluginRequest(request, root)}`,
          ];
        } catch (error) {
          return [name, `error:${String((error as { code?: unknown }).code)}`];
        }
      }),
    );
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
      barrel: `file:${path.join(root, "node_modules", "pkg-barrel", "descriptor.cjs")}`,
      pattern: `file:${path.join(root, "node_modules", "pkg-pattern", "descriptors", "prefix.cjs")}`,
      ordinary: `file:${path.join(root, "node_modules", "pkg-ordinary", "runtime.cjs")}`,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
