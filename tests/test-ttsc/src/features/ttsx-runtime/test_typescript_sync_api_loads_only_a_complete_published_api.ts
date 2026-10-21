import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { TypeScriptSyncApi } from "../../../../../packages/ttsc/src/launcher/internal/TypeScriptSyncApi";
import { CompilerTarget } from "../../../../../packages/ttsc/src/plugin/internal/source/CompilerTarget";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that the in-memory build finds the synchronous API only in a
 * TypeScript package that publishes all of it.
 *
 * TypeScript 7.1 publishes `typescript/sync` with an emitting program; 7.0
 * publishes only `typescript/unstable/sync`, whose program cannot emit. A
 * missing or partial API must leave the build on the command line.
 *
 * 1. Load packages without a `./sync` export, with one whose program lacks
 *    `emitToString`, and with a complete one.
 * 2. Load the workspace's own TypeScript, whose line decides the answer.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production TypeScriptSyncApi.load against real package manifests on disk, resolved through Node's own exports resolution by package name.
 * @evidence contracts/testing.md#independent-expectations The authored packages define exactly which members exist; the workspace expectation follows the published exports of TypeScript 7.0 (no ./sync) and 7.1 (./sync with Program.emitToString).
 * @evidence contracts/testing.md#distinguishing-cases An absent export, a present export missing one member and a complete export distinguish export resolution from member checking; the complete package returns its own API class, not a substitute.
 * @evidence contracts/testing.md#execution-ownership A source unit over temporary package directories; requiring the authored CommonJS modules starts no process, and the workspace package is only required.
 */
export function test_typescript_sync_api_loads_only_a_complete_published_api(): void {
  const root = TestProject.tmpdir("ttsc-sync-api-");
  const definePackage = (
    name: string,
    exports: Record<string, string>,
    module?: string,
  ): string => {
    const directory = path.join(root, "node_modules", name);
    fs.mkdirSync(directory, { recursive: true });
    const manifest = path.join(directory, "package.json");
    fs.writeFileSync(manifest, JSON.stringify({ name, exports }));
    if (module !== undefined)
      fs.writeFileSync(path.join(directory, "sync.cjs"), module);
    return manifest;
  };
  const api = (programMembers: string): string =>
    [
      "class API {",
      "  get createSnapshot() { return () => undefined; }",
      "  get parseCommandLine() { return () => undefined; }",
      "  close() {}",
      "}",
      `class Program { ${programMembers} }`,
      "exports.API = API;",
      "exports.Program = Program;",
      "exports.formatDiagnostics = () => '';",
      "",
    ].join("\n");

  assert.equal(
    TypeScriptSyncApi.load(
      definePackage("no-sync", { "./package.json": "./package.json" }),
    ),
    undefined,
    "a package without ./sync",
  );
  assert.equal(
    TypeScriptSyncApi.load(
      definePackage("no-emit", { "./sync": "./sync.cjs" }, api("")),
    ),
    undefined,
    "a program without emitToString",
  );
  const complete = TypeScriptSyncApi.load(
    definePackage(
      "complete",
      { "./sync": "./sync.cjs" },
      api("get emitToString() { return () => undefined; }"),
    ),
  );
  assert.ok(complete, "a complete API");
  assert.equal(
    complete.API,
    (
      createRequire(import.meta.url)(
        path.join(root, "node_modules", "complete", "sync.cjs"),
      ) as {
        API: unknown;
      }
    ).API,
  );

  const workspace = createRequire(
    path.join(TestProject.WORKSPACE_ROOT, "package.json"),
  ).resolve("typescript/package.json");
  const { version } = JSON.parse(fs.readFileSync(workspace, "utf8")) as {
    version: string;
  };
  assert.equal(
    TypeScriptSyncApi.load(workspace) !== undefined,
    CompilerTarget.lineOf(version).line !== "7.0",
    `workspace TypeScript ${version}`,
  );
}
