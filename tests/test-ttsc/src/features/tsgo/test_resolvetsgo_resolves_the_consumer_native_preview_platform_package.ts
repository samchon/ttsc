import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/lib/compiler/internal/resolveTsgo.js";

/**
 * Verifies resolveTsgo resolves the consumer native-preview platform package.
 *
 * This ttsc tsgo resolver scenario is owned by a tests package instead of the
 * production package manifest, so package.json stays focused on build and
 * publish contracts while the feature file documents the behavior under test.
 *
 * 1. Prepare the isolated project, resolver input, or plugin source fixture.
 * 2. Invoke the package API or internal resolver path being pinned.
 * 3. Assert the returned files, diagnostics, cache key, or descriptor contract.
 */
export const test_resolvetsgo_resolves_the_consumer_native_preview_platform_package =
  () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-tsgo-test-"));
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
