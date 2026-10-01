import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolvePluginGoModule } from "../../../../../packages/ttsc/src/plugin/internal/source/resolvePluginGoModule";

/**
 * Verifies source-plugin module selection before any compiler is started.
 *
 * A source names either its package directory or the owning go.mod. The
 * production resolver must retain the package entry and use the nearest
 * manifest within three parents, rejecting the fourth rather than guessing.
 *
 * 1. Resolve a go.mod file and its directory and require the module root as
 *    package.
 * 2. Resolve a directory three parents below the manifest and require its relative
 *    entry, then one four parents below and require the exact rejection.
 * 3. Add a nearer go.mod and require the nearest manifest to win, then resolve a
 *    plain source file and require the exact rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the authored resolvePluginGoModule against real manifests and directories; verifies exact moduleRoot, packageDir and Go entry, and the complete rejected-depth diagnostic.
 * @evidence contracts/testing.md#independent-expectations Literal entries dot, ./a/b/c and ./b/c/d and the independently assembled diagnostic define the expected identities; no production resolver constructs the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Owns a direct manifest, module directory, exactly three parents, rejected fourth parent, nearer nested manifest and a non-manifest source file.
 * @evidence contracts/testing.md#execution-ownership This named exported test is selected from unit/compiler and exercises source selection without native builds, descriptor evaluators or product CLI processes; finally removes its owned temporary tree.
 */
export function test_source_plugin_module_resolution_preserves_manifest_and_bounded_package_identity(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-module-resolution-"));
  try {
    const manifest = path.join(root, "go.mod");
    fs.writeFileSync(manifest, "module example.test/plugin\n\ngo 1.24\n");
    const third = path.join(root, "a", "b", "c");
    const fourth = path.join(third, "d");
    fs.mkdirSync(fourth, { recursive: true });
    assert.deepEqual(resolvePluginGoModule(manifest, "manifest"), {
      entry: ".", moduleRoot: root, packageDir: root,
    });
    assert.deepEqual(resolvePluginGoModule(root, "directory"), {
      entry: ".", moduleRoot: root, packageDir: root,
    });
    assert.deepEqual(resolvePluginGoModule(third, "third"), {
      entry: "./a/b/c", moduleRoot: root, packageDir: third,
    });
    assert.throws(() => resolvePluginGoModule(fourth, "go-source-plugin-too-deep"), {
      message: `ttsc: plugin "go-source-plugin-too-deep" source must be inside a Go module with go.mod within 3 parent directories: ${fourth}`,
    });
    const nested = path.join(root, "a");
    fs.writeFileSync(path.join(nested, "go.mod"), "module example.test/nested\n");
    assert.deepEqual(resolvePluginGoModule(fourth, "nearest"), {
      entry: "./b/c/d", moduleRoot: nested, packageDir: fourth,
    });
    const sourceFile = path.join(root, "main.go");
    fs.writeFileSync(sourceFile, "package main\n");
    assert.throws(() => resolvePluginGoModule(sourceFile, "file"), {
      message: `ttsc: plugin "file" source must be a Go package directory or go.mod file: ${sourceFile}`,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}
