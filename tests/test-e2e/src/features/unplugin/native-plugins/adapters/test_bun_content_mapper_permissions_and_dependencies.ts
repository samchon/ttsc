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
 * Banner completeness retains mapper declarations independently of graph edges.
 * SQL type diagnostics use the shared program probe without a completeness
 * declaration, with its resident baseline established before the SQL edit.
 *
 * 1. Reuse the installed batch workspace and create one mapper project island.
 * 2. Join a Bun child for bundling and a Node owner for shared/resident
 *    deliveries, reusing the native program probe for SQL graph invalidation.
 * 3. Assert permission isolation, changed/missing inputs and mapper reaping.
 *
 * @evidence contracts/testing.md#behavioral-verification The real Bun child loads the installed adapter and executes bundled output; its Node coordinator contrasts concurrent permissions, reuses resident/shared results, changes schema/manifest under banner completeness and SQL after establishing an unmarked program-probe generation, changes argument/root inputs and requires mapper PIDs to be reaped.
 * @evidence contracts/testing.md#independent-expectations Authored name/label properties and string/number schemas require literal runtime values or upstream type errors; method counts independently distinguish reuse from recompilation, including the graph baseline. ESRCH, a different native birth identifier or absence of the original Windows mapper's unique pipe proves departure despite PID reuse. The pipe stays open until process death; Linux uses start ticks and macOS a native start stamp. Failed queries/timeouts remain failures; macOS can conservatively reject same-second reuse.
 * @evidence contracts/testing.md#distinguishing-cases Covers enabled, disabled and inherited permission, worker adoption, changed/missing schema, complete banner declarations versus an unmarked program contributor's SQL graph inputs, manifest changes, missing-manifest recovery registration, response file changes, unimported mapper roots, CLI allowJs roots and error recovery. Fresh Webpack processes contrast actual filesystem-cache restoration with inherited and explicit permission changes over unchanged files. The existing 7.0 driver negative case retains unsupported-flag behavior.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch imports this entry; it runs only with the installed pinned 7.1 compiler. A Node child owns worker caches and joins its real Bun bundler child; each compiler invocation owns its mapper processes.
 * @evidence contracts/e2e.md#necessary-boundary Actual installed Bun adapter, worker transport, native compiler target and mapper protocol cannot be certified by option/key units.
 * @evidence contracts/e2e.md#shared-execution Borrows the existing batch installation, native artifact cache and program-probe source. One Node coordinator joins one Bun build with the installed banner plugin, then proves cache epochs under Node's complete descriptor-import observation. The extra program-contributor epoch is required to test graph invalidation without a completeness declaration. Fresh joined Webpack epochs additionally prove persistent restoration skips transforms only for an unchanged invocation. The two runtimes are necessary for the actual Bun adapter and reusable plugin generations, and share one project and installation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity One isolated project and owned shared store live under the batch workspace. Each mutation supplies a required invalidation epoch; both caches reset in finally, Bun completion closes its generation, mapper method counts and per-process witnesses verify cleanup without confusing PID reuse, and the batch owner removes the island after the joined child. Linux reads proc metadata and macOS joins ps. Windows mappers own a unique kernel pipe until killed; coordinator probes close their socket/timer on settlement, and a timeout rejects rather than claiming departure.
 * @evidence contracts/e2e.md#preserved-coverage Every permission, reuse, changed/missing input and recovery assertion remains. SQL rejection now uses an explicitly established, reused graph-dependent generation; complete banner schema/manifest checks remain separate. Every original mapper must still have departed, with a later PID occupant distinguished by its native birth or the original process-owned pipe. Existing Bun graph, runtime, registration and repeated-build coverage remains unchanged.
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
    "graph-plugins.json": JSON.stringify([
      {
        name: "mapper-graph-probe",
        transform: path.join(workspace.root, "compile-probe.cjs"),
        fixtureSource: path.join(workspace.root, "native-source/compile-probe"),
        operation: "identity",
      },
    ]),
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
    "node_modules/sql-mapper/process-witness.cjs": fs.readFileSync(
      path.join(fixture, "process-witness.cjs"),
      "utf8",
    ),
    "process-witness.cjs": fs.readFileSync(
      path.join(fixture, "process-witness.cjs"),
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
