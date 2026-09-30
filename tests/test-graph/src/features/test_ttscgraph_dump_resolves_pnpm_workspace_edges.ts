import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { dumpGraph, findEdge, findNode } from "../internal/graphDump";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies graph dump resolves pnpm workspace package links to sibling source.
 *
 * A pnpm monorepo presents workspace packages through node_modules links, but
 * the graph must follow the TypeScript checker to the real sibling declaration
 * instead of stopping at the package import string or treating the sibling as
 * an opaque dependency. This locks the monorepo shape used by projects such as
 * autobe: one package tsconfig can still produce edges into another workspace
 * package when the checker resolves that package to source.
 *
 * 1. Materialize an app package that imports a linked workspace package.
 * 2. Build a dump from the workspace root with the app package tsconfig.
 * 3. Assert calls, type refs, and heritage edges target sibling package nodes.
 *
 * @evidence contracts/testing.md#behavioral-verification Real dump resolves a physically linked shared workspace package to local nodes and call/type_ref/extends edges without leaking node_modules alias spelling.
 * @evidence contracts/testing.md#independent-expectations Authored shared function/interface/class and app references specify expected targets; literal nonexternal flags and absence of alias paths distinguish canonical workspace identity.
 * @evidence contracts/testing.md#distinguishing-cases A linked workspace dependency must remain local, unlike ordinary external node_modules leaves; the actual junction/symlink exercises kernel resolution.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_dump_resolves_pnpm_workspace_edges runs the actual native dump producer on its fixture project; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native resolver/checker output must cross the real workspace link and preserve canonical paths; a path string or mocked symlink predicate cannot prove that filesystem connection.
 * @evidence contracts/e2e.md#shared-execution One app/shared workspace fixture and real dump reuse the suite compiler. Link setup is shared within this case; cross-case project/load batching remains unfinished.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The link and both source roots belong to this fixture, preventing another package's cache identity from substituting; dump is synchronous and tracked fixture removal owns cleanup.
 * @evidence contracts/e2e.md#preserved-coverage All app/shared node checks, nonexternal flags, alias-path exclusions and three relation-kind assertions remain; real link capability is not replaced by a no-op fixture.
 */
export const test_ttscgraph_dump_resolves_pnpm_workspace_edges = () => {
  const root = TestProject.tmpdir("ttsc-graph-workspace-");
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({
      private: true,
      name: "workspace-root",
    }),
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "packages/shared/package.json": JSON.stringify({
      name: "@scope/shared",
      version: "1.0.0",
      main: "src/index.ts",
      types: "src/index.ts",
    }),
    "packages/shared/src/index.ts": [
      "export interface SharedInput {",
      "  value: string;",
      "}",
      "export function sharedHelper(input: SharedInput): string {",
      "  return input.value;",
      "}",
      "export class SharedService {",
      "  run(input: SharedInput): string {",
      "    return sharedHelper(input);",
      "  }",
      "}",
      "",
    ].join("\n"),
    "packages/app/package.json": JSON.stringify({
      name: "@scope/app",
      version: "1.0.0",
      dependencies: { "@scope/shared": "workspace:*" },
    }),
    "packages/app/tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        strict: true,
        skipLibCheck: true,
      },
      include: ["src"],
    }),
    "packages/app/src/main.ts": [
      'import { SharedService, sharedHelper, type SharedInput } from "@scope/shared";',
      "export function run(input: SharedInput): string {",
      "  return sharedHelper(input);",
      "}",
      "export class AppService extends SharedService {",
      "  override run(input: SharedInput): string {",
      "    return super.run(input);",
      "  }",
      "}",
      "",
    ].join("\n"),
  });
  linkWorkspacePackage(
    path.join(root, "packages", "shared"),
    path.join(root, "node_modules", "@scope", "shared"),
  );

  const dump = dumpGraph(root, "packages/app/tsconfig.json");
  const run = findNode(dump, {
    file: "packages/app/src/main.ts",
    name: "run",
    kind: "function",
  });
  const appService = findNode(dump, {
    file: "packages/app/src/main.ts",
    name: "AppService",
    kind: "class",
  });
  const sharedHelper = findNode(dump, {
    file: "packages/shared/src/index.ts",
    name: "sharedHelper",
    kind: "function",
  });
  const sharedInput = findNode(dump, {
    file: "packages/shared/src/index.ts",
    name: "SharedInput",
    kind: "interface",
  });
  const sharedService = findNode(dump, {
    file: "packages/shared/src/index.ts",
    name: "SharedService",
    kind: "class",
  });

  assert.ok(run, "workspace app function is present in the dump");
  assert.ok(appService, "workspace app class is present in the dump");
  assert.ok(sharedHelper, "sibling package function is present in the dump");
  assert.ok(sharedInput, "sibling package interface is present in the dump");
  assert.ok(sharedService, "sibling package class is present in the dump");
  assert.equal(sharedHelper.external, false, "sibling source is not external");
  assert.equal(
    sharedInput.external,
    false,
    "sibling type source is not external",
  );
  assert.equal(
    dump.nodes.some((node) => node.file.includes("node_modules/@scope/shared")),
    false,
    "pnpm package link resolves to real sibling source paths",
  );
  assert.ok(
    findEdge(dump, run, sharedHelper, "calls"),
    "app function call resolves to the sibling package function",
  );
  assert.ok(
    findEdge(dump, run, sharedInput, "type_ref"),
    "app parameter type resolves to the sibling package interface",
  );
  assert.ok(
    findEdge(dump, appService, sharedService, "extends"),
    "app class heritage resolves to the sibling package class",
  );
};

function linkWorkspacePackage(target: string, link: string): void {
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync(
    target,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
}
