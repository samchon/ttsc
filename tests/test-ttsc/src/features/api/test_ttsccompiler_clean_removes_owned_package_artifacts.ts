import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TtscCompiler } from "../../../../../packages/ttsc/src/TtscCompiler";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that clean reclaims only package artifacts in a ttsc-owned root.
 *
 * 1. Seed a default workspace cache with package bodies and a separate user Go
 *    cache, then clean through the public compiler API.
 * 2. Seed an explicitly shared cache root and require its package bodies to
 *    survive while its plugin binary cache is cleaned.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls TtscCompiler.clean on real seeded cache trees and asserts deletion of the owned artifact generation, survival of caller-owned files and the reported paths.
 * @evidence contracts/testing.md#independent-expectations The declared workspace root owns its default node_modules/.cache/ttsc payload, while an explicitly shared TTSC_CACHE_DIR and GOCACHE remain caller-owned under the public clean contract.
 * @evidence contracts/testing.md#distinguishing-cases Default-owned package bodies are reclaimed; identical bodies in a shared root and an external Go cache survive; a plugin cache in the shared root remains cleanable.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the in-process clean API on a tracked temporary project and starts no native build or installed consumer.
 */
export function test_ttsccompiler_clean_removes_owned_package_artifacts(): void {
  const project = TestProject.tmpdir("ttsc-clean-package-artifacts-");
  fs.writeFileSync(path.join(project, "package.json"), '{"private":true}');
  fs.writeFileSync(path.join(project, "tsconfig.json"), "{}");
  fs.writeFileSync(
    path.join(project, "pnpm-workspace.yaml"),
    "packages:\n  - .\n",
  );
  const source = path.join(project, "main.ts");
  fs.writeFileSync(source, "export const value = 42;\n");
  const defaultRoot = path.join(project, "node_modules", ".cache", "ttsc");
  const defaultArtifact = path.join(defaultRoot, "package-artifacts");
  const defaultBody = path.join(defaultArtifact, "base", "packs", "body");
  const defaultPlugin = path.join(defaultRoot, "plugins");
  const defaultGo = path.join(defaultRoot, "go-build");
  const userGo = path.join(project, "user-go-cache");
  for (const file of [
    defaultBody,
    path.join(defaultPlugin, "binary"),
    path.join(defaultGo, "object"),
    path.join(userGo, "object"),
  ]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "owned or protected\n");
  }
  const clean = (env: NodeJS.ProcessEnv): string[] =>
    new TtscCompiler({ cwd: project, env }).clean();
  const removed = clean({
    TTSC_CACHE_DIR: undefined,
    TTSC_GO_CACHE_DIR: undefined,
    GOCACHE: userGo,
  });
  assert.deepEqual(
    new Set(removed),
    new Set([defaultPlugin, defaultGo, defaultArtifact]),
  );
  assert.equal(fs.existsSync(defaultBody), false);
  assert.equal(fs.existsSync(userGo), true);

  const sharedRoot = path.join(project, "shared");
  const sharedBody = path.join(
    sharedRoot,
    "package-artifacts",
    "base",
    "packs",
    "body",
  );
  const sharedPlugin = path.join(sharedRoot, "plugins", "binary");
  for (const file of [sharedBody, sharedPlugin]) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "shared\n");
  }
  assert.deepEqual(clean({ TTSC_CACHE_DIR: sharedRoot, GOCACHE: userGo }), [
    path.dirname(sharedPlugin),
  ]);
  assert.equal(fs.readFileSync(sharedBody, "utf8"), "shared\n");
  assert.equal(fs.existsSync(sharedPlugin), false);
  assert.equal(fs.readFileSync(source, "utf8"), "export const value = 42;\n");
}
