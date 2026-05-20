import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";

/**
 * Verifies resolveTsgo resolves the consumer's `@typescript/native-preview`
 * platform package.
 *
 * The normal resolution path walks from `cwd` into `node_modules` to find
 * `@typescript/native-preview`, reads its version and `gitHead`, then locates
 * the platform-specific sibling package that contains the actual `tsgo` binary.
 * Pins the full resolution contract so changes to the package naming scheme or
 * binary location are caught before they silently fall back to a system-level
 * tsgo.
 *
 * 1. Materialize a fake `@typescript/native-preview` tree with both the root and
 *    platform-specific packages under a temp `node_modules`.
 * 2. Call `resolveTsgo` with `cwd` pointing at the temp directory.
 * 3. Assert `binary`, `version`, and `gitHead` all match the fake package
 *    metadata.
 */
export const test_resolvetsgo_resolves_the_consumer_native_preview_platform_package =
  () => {
    const root = TestProject.tmpdir("ttsc-tsgo-test-");
    const nativeRoot = path.join(
      root,
      "node_modules",
      "@typescript",
      "native-preview",
    );
    const platformRoot = path.join(
      root,
      "node_modules",
      "@typescript",
      `native-preview-${process.platform}-${process.arch}`,
    );
    fs.mkdirSync(nativeRoot, { recursive: true });
    fs.mkdirSync(path.join(platformRoot, "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(nativeRoot, "package.json"),
      JSON.stringify({
        name: "@typescript/native-preview",
        version: "7.0.0-dev.consumer",
        gitHead: "abc123",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(platformRoot, "package.json"),
      JSON.stringify({
        name: `@typescript/native-preview-${process.platform}-${process.arch}`,
        version: "7.0.0-dev.consumer",
      }),
      "utf8",
    );
    const binary = path.join(
      platformRoot,
      "lib",
      process.platform === "win32" ? "tsgo.exe" : "tsgo",
    );
    fs.writeFileSync(binary, "", "utf8");

    const resolved = resolveTsgo({
      cwd: root,
      env: {},
    });

    assert.equal(resolved.version, "7.0.0-dev.consumer");
    assert.equal(resolved.gitHead, "abc123");
    assert.equal(resolved.binary, binary);
  };
