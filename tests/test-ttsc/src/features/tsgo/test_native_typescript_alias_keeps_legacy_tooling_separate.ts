import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { resolveTsgo } from "../../../../../packages/ttsc/src/compiler/internal/resolveTsgo";
import { CompilerTarget } from "../../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { pluginBuildVersions } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginBuildVersions";
import { resolveTsgoBinary } from "../../../../../packages/vscode/src/serverResolution";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies native compiler selection stays separate from legacy tooling.
 *
 * The compiler path, build target, cache version and editor must all select the
 * alias while ESLint can keep resolving the legacy package.
 *
 * 1. Install authored legacy and aliased native manifests with distinct binaries.
 * 2. Observe all four owners and change the alias version to check fresh reads.
 * 3. Contrast alias precedence, missing binaries, fallback anchors and legacy-only
 *    input.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls resolveTsgo, CompilerTarget.resolve, pluginBuildVersions and the editor resolver over filesystem inputs; native metadata and path assertions catch legacy selection and cache disagreement, while a missing alias binary must fail without using the default compiler.
 * @evidence contracts/testing.md#independent-expectations Literal native versions 7.0.2 and 7.1.0-dev.20261020.3 prescribe their build lines; independently authored binary paths distinguish alias and ordinary installs, while legacy 6.0.2 cannot supply a native compiler.
 * @evidence contracts/testing.md#distinguishing-cases Covers arbitrary scoped alias coexistence, workspace-local declaration isolation, alias precedence, version changes, invalid installed identity/version, ambiguous aliases, alias-only input, explicit binary priority, missing executable and recovery, resolveFrom fallback, malformed metadata and legacy-only rejection. Existing resolver units retain ordinary install and invalid override coverage.
 * @evidence contracts/testing.md#execution-ownership The unit runner discovers this named export under features/tsgo; all owners execute directly over TestProject-managed temporary manifests and empty executable files. No compiler, editor host or consumer installation runs.
 */
export function test_native_typescript_alias_keeps_legacy_tooling_separate(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-native-alias-"),
  );
  const legacy = path.join(root, "node_modules", "typescript", "package.json");
  const alias = path.join(
    root,
    "node_modules",
    "@compiler",
    "current",
    "package.json",
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      devDependencies: { "@compiler/current": "npm:typescript@7.0.2" },
    }),
  );
  const platform = `@typescript/typescript-${process.platform}-${process.arch}`;
  const aliasPlatform = path.join(
    path.dirname(alias),
    "node_modules",
    platform,
  );
  const ordinaryPlatform = path.join(root, "node_modules", platform);
  const executable = process.platform === "win32" ? "tsc.exe" : "tsc";
  const aliasBinary = path.join(aliasPlatform, "lib", executable);
  const ordinaryBinary = path.join(ordinaryPlatform, "lib", executable);
  for (const directory of [
    path.dirname(legacy),
    path.dirname(alias),
    path.dirname(aliasBinary),
    path.dirname(ordinaryBinary),
  ])
    fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    legacy,
    JSON.stringify({ name: "@typescript/typescript6", version: "6.0.2" }),
  );
  fs.writeFileSync(
    alias,
    JSON.stringify({
      name: "typescript",
      version: "7.0.2",
      gitHead: "native-head",
    }),
  );
  for (const directory of [aliasPlatform, ordinaryPlatform]) {
    fs.writeFileSync(
      path.join(directory, "package.json"),
      JSON.stringify({ name: platform, version: "7.0.2" }),
    );
    fs.writeFileSync(path.join(directory, "lib", executable), "");
  }

  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, aliasBinary);
  assert.equal(resolveTsgo({ cwd: root, env: {} }).gitHead, "native-head");
  assert.equal(CompilerTarget.resolve(root, {}), "7.0");
  assert.equal(pluginBuildVersions(root).tsgo, "7.0.2");
  assert.equal(resolveTsgoBinary(root), aliasBinary);
  const workspace = path.join(root, "workspace");
  const workspaceManifest = path.join(
    workspace,
    "node_modules",
    "typescript",
    "package.json",
  );
  fs.mkdirSync(path.dirname(workspaceManifest), { recursive: true });
  fs.writeFileSync(
    path.join(workspace, "package.json"),
    JSON.stringify({ devDependencies: { typescript: "7.0.2" } }),
  );
  fs.writeFileSync(
    workspaceManifest,
    JSON.stringify({ name: "typescript", version: "7.0.2" }),
  );
  assert.equal(
    resolveTsgo({ cwd: workspace, env: {} }).packageJson,
    workspaceManifest,
  );
  assert.equal(pluginBuildVersions(workspace).tsgo, "7.0.2");
  fs.writeFileSync(
    alias,
    JSON.stringify({ name: "typescript", version: "7.1.0-dev.20261020.3" }),
  );
  assert.equal(CompilerTarget.resolve(root, {}), "7.1");
  assert.equal(pluginBuildVersions(root).tsgo, "7.1.0-dev.20261020.3");

  fs.writeFileSync(
    legacy,
    JSON.stringify({ name: "typescript", version: "7.0.2" }),
  );
  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, aliasBinary);
  fs.writeFileSync(
    alias,
    JSON.stringify({ name: "another-package", version: "7.1.0" }),
  );
  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, ordinaryBinary);
  fs.writeFileSync(
    alias,
    JSON.stringify({ name: "typescript", version: "7malformed.1.0" }),
  );
  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, ordinaryBinary);
  fs.writeFileSync(
    alias,
    JSON.stringify({ name: "typescript", version: "7.1.0" }),
  );
  assert.equal(
    resolveTsgo({ cwd: root, binary: ordinaryBinary, env: {} }).binary,
    ordinaryBinary,
  );
  fs.unlinkSync(aliasBinary);
  assert.throws(
    () => resolveTsgo({ cwd: root, env: {} }),
    /TypeScript executable not found/,
  );
  assert.equal(resolveTsgoBinary(root), undefined);
  fs.writeFileSync(aliasBinary, "");
  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, aliasBinary);
  const secondAlias = path.join(
    root,
    "node_modules",
    "another-compiler",
    "package.json",
  );
  fs.mkdirSync(path.dirname(secondAlias), { recursive: true });
  fs.writeFileSync(
    secondAlias,
    JSON.stringify({ name: "typescript", version: "7.0.2" }),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      dependencies: { "another-compiler": "npm:typescript@7.0.2" },
      devDependencies: { "@compiler/current": "npm:typescript@7.0.2" },
    }),
  );
  assert.throws(
    () => resolveTsgo({ cwd: root, env: {} }),
    /multiple native TypeScript aliases/,
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      optionalDependencies: { "@compiler/current": "npm:typescript@7.0.2" },
    }),
  );
  fs.unlinkSync(legacy);
  assert.equal(resolveTsgo({ cwd: root, env: {} }).binary, aliasBinary);

  const other = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-native-fallback-"),
  );
  assert.equal(
    resolveTsgo({
      cwd: other,
      resolveFrom: path.join(root, "package.json"),
      env: {},
    }).binary,
    aliasBinary,
  );
  fs.writeFileSync(alias, "{");
  assert.throws(() => resolveTsgo({ cwd: root, env: {} }), SyntaxError);
  assert.equal(pluginBuildVersions(root).tsgo, "unknown");
  fs.unlinkSync(alias);
  fs.writeFileSync(
    legacy,
    JSON.stringify({ name: "@typescript/typescript6", version: "6.0.2" }),
  );
  assert.throws(
    () => resolveTsgo({ cwd: root, env: {} }),
    /native TypeScript 7 or newer is required/,
  );
  assert.equal(pluginBuildVersions(root).tsgo, "unknown");
  assert.equal(resolveTsgoBinary(root), undefined);
}
