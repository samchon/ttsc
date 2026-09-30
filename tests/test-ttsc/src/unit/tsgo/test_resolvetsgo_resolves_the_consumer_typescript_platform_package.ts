import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";

/**
 * Verifies resolveTsgo resolves the consumer's `typescript` platform package.
 *
 * The normal resolution path walks from `cwd` into `node_modules` to find
 * `typescript`, reads its version and `gitHead`, then locates the
 * platform-specific `@typescript/typescript-<platform>-<arch>` sibling package
 * that contains the actual `tsc` binary. Pins the full resolution contract so
 * changes to the package naming scheme or binary location are caught before
 * they silently fall back to a system-level compiler.
 *
 * 1. Materialize a fake `typescript` tree with the root package and the
 *    platform-specific package under a temp `node_modules`.
 * 2. Call `resolveTsgo` with `cwd` pointing at the temp directory.
 * 3. Assert `binary`, `version`, and `gitHead` all match the fake package
 *    metadata.
 *
 * @evidence contracts/testing.md#behavioral-verification resolveTsgo returns the consumer platform binary, version and gitHead and reports a missing binary without inventing a fallback.
 * @evidence contracts/testing.md#independent-expectations the independently authored fixture package graph and literal metadata define the supported consumer compiler identity.
 * @evidence contracts/testing.md#distinguishing-cases a complete fixture installation contrasts with a deleted executable and successful restoration.
 * @evidence contracts/testing.md#execution-ownership The named test_resolvetsgo_resolves_the_consumer_typescript_platform_package function runs under src/unit/tsgo and calls the authored resolver directly; manifests and empty binary files are filesystem inputs, not an installed or launched compiler.
 */
export function test_resolvetsgo_resolves_the_consumer_typescript_platform_package() {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-tsgo-test-"),
    );
    const nativeRoot = path.join(root, "node_modules", "typescript");
    const platformRoot = path.join(
      root,
      "node_modules",
      "@typescript",
      `typescript-${process.platform}-${process.arch}`,
    );
    fs.mkdirSync(nativeRoot, { recursive: true });
    fs.mkdirSync(path.join(platformRoot, "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(nativeRoot, "package.json"),
      JSON.stringify({
        name: "typescript",
        version: "7.0.1-rc.consumer",
        gitHead: "abc123",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(platformRoot, "package.json"),
      JSON.stringify({
        name: `@typescript/typescript-${process.platform}-${process.arch}`,
        version: "7.0.1-rc.consumer",
      }),
      "utf8",
    );
    const binary = path.join(
      platformRoot,
      "lib",
      process.platform === "win32" ? "tsc.exe" : "tsc",
    );
    fs.writeFileSync(binary, "", "utf8");

    const resolved = resolveTsgo({
      cwd: root,
      env: {},
    });

    assert.equal(resolved.version, "7.0.1-rc.consumer");
    assert.equal(resolved.gitHead, "abc123");
    assert.equal(resolved.binary, binary);
    fs.unlinkSync(binary);
    assert.throws(() => resolveTsgo({ cwd: root, env: {} }), /TypeScript executable not found/);
    fs.writeFileSync(binary, "", "utf8");
    assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, binary);
}
