import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { BatchWorkspace } from "../../../../batch/BatchWorkspace";

/**
 * Verifies content mapper permission, dependencies and cleanup through built
 * adapters.
 *
 * The TypeScript 7.1 lane owns this boundary; TypeScript 7.0 has no mappers.
 *
 * 1. Reuse the installed batch workspace and create one mapper project island.
 * 2. Join a Bun child for bundling and a Node owner for shared/resident
 *    deliveries.
 * 3. Assert permission isolation, changed/missing inputs and mapper reaping.
 *
 * @evidence contracts/testing.md#behavioral-verification The real Bun child loads the installed adapter and executes bundled output; its Node coordinator contrasts concurrent permissions, reuses resident/shared results, changes schema/SQL/manifest and argument/root inputs and requires mapper PIDs to be reaped.
 * @evidence contracts/testing.md#independent-expectations Authored name/label properties and string/number schemas require literal runtime values or upstream type errors; method counts independently distinguish reuse from recompilation and PID ESRCH proves the mapper processes ended.
 * @evidence contracts/testing.md#distinguishing-cases Covers enabled, disabled and inherited permission, worker adoption, changed/missing schema, SQL/manifest changes, missing-manifest recovery registration, response file changes, unimported mapper roots, CLI allowJs roots and error recovery. Fresh Webpack processes contrast actual filesystem-cache restoration with inherited and explicit permission changes over unchanged files. The existing 7.0 driver negative case retains unsupported-flag behavior.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch imports this entry; it runs only with the installed pinned 7.1 compiler. A Node child owns worker caches and joins its real Bun bundler child; each compiler invocation owns its mapper processes.
 * @evidence contracts/e2e.md#necessary-boundary Actual installed Bun adapter, worker transport, native compiler target and mapper protocol cannot be certified by option/key units.
 * @evidence contracts/e2e.md#shared-execution Borrows the existing batch installation and native artifact cache. One Node coordinator joins one Bun build with the installed banner plugin, then proves cache epochs under Node's complete descriptor-import observation. Fresh joined Webpack epochs additionally prove persistent restoration skips transforms only for an unchanged invocation. The two runtimes are necessary for the actual Bun adapter and reusable plugin generations, and share one project and installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One isolated project and owned shared store live under the batch workspace. Each mutation supplies a required invalidation epoch; both caches reset in finally, Bun completion closes its generation, mapper method counts and PID absence verify cleanup, and the batch owner removes the island after the joined child.
 * @evidence contracts/e2e.md#preserved-coverage This adds the 7.1 permission and mapper-input boundary; existing Bun graph, runtime, registration and repeated-build coverage remains unchanged.
 */
export async function test_bun_content_mapper_permissions_and_dependencies(): Promise<
  void | false
> {
  const workspace = await BatchWorkspace.open();
  const require = createRequire(path.join(workspace.root, "package.json"));
  const version = JSON.parse(
    fs.readFileSync(require.resolve("typescript/package.json"), "utf8"),
  ).version as string;
  if (!version.startsWith("7.1.")) {
    console.log("content-mappers: skipped on TypeScript " + version);
    return false;
  }
  const root = path.join(workspace.root, "content-mapper-project");
  const fixture = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/unplugin/content-mapper",
  );
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({ private: true, type: "module" }),
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        strict: true,
        target: "es2020",
        module: "esnext",
        moduleResolution: "bundler",
        plugins: [{ transform: "@ttsc/banner" }],
      },
      include: ["*.ts", "*.sql", "*.js"],
      contentMappers: [{ package: "sql-mapper", extensions: [".sql"] }],
    }),
    "flags.rsp": "--strict",
    "banner.config.json": JSON.stringify({ text: "Content mapper consumer" }),
    "index.ts":
      'import type { query } from "./query.sql"; export const value: typeof query = { name: "ok" };\n',
    "query.sql": "name",
    "node_modules/sql-mapper/package.json": JSON.stringify({
      name: "sql-mapper",
      version: "1.0.0",
      typescript: {
        contentMapper: {
          exec: [process.execPath, "./mapper.cjs"],
          dynamicConfig: true,
        },
      },
    }),
    "node_modules/sql-mapper/schema.txt": "string",
    "node_modules/sql-mapper/mapper.cjs": fs.readFileSync(
      path.join(fixture, "mapper.cjs"),
      "utf8",
    ),
    "run.mjs": fs.readFileSync(path.join(fixture, "run.mjs"), "utf8"),
    "bundle.mjs": fs.readFileSync(path.join(fixture, "bundle.mjs"), "utf8"),
    "webpack-permission.mjs": fs.readFileSync(
      path.join(fixture, "webpack-permission.mjs"),
      "utf8",
    ),
    "strip-loader.cjs": fs.readFileSync(
      path.join(fixture, "strip-loader.cjs"),
      "utf8",
    ),
  });
  const result = TestProject.spawn(process.execPath, ["run.mjs"], {
    cwd: root,
    env: {
      TTSC_CACHE_DIR: workspace.cache,
      TTSC_TSGO_ARGS: JSON.stringify(["@flags.rsp", "--runExternalCode"]),
      TTSC_TSGO_ARGS_CWD: root,
      TTSC_TEST_WEBPACK_ENTRY: createRequire(import.meta.url).resolve(
        "webpack",
      ),
      TTSC_TEST_ESBUILD_ENTRY: createRequire(import.meta.url).resolve(
        "esbuild",
      ),
    },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /^content-mappers:passed$/m);
}
