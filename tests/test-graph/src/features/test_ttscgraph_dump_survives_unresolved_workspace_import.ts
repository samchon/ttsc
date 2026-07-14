import { TestProject } from "@ttsc/testing";

import { dumpGraph, findNode } from "../internal/graphDump";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies graph dump degrades gracefully when a workspace import does not
 * resolve.
 *
 * A pnpm workspace normally links sibling packages through node_modules, but a
 * Yarn PnP layout (no node_modules), an incomplete install, or a not-yet-linked
 * package leaves the checker unable to resolve the import. The dump must still
 * produce a usable graph for the files it can compile — exiting non-zero or
 * crashing on the unresolved specifier would take down a whole monorepo's graph
 * for one missing link. The importing package's own declarations stay in the
 * graph; the unresolved sibling is simply absent, not an external leak.
 *
 * 1. Materialize an app package that imports a sibling by its package name.
 * 2. Omit the node_modules link so the specifier cannot resolve.
 * 3. Assert the dump still loads, keeps the app node, and drops the sibling.
 */
export const test_ttscgraph_dump_survives_unresolved_workspace_import = () => {
  const root = TestProject.tmpdir("ttsc-graph-unresolved-");
  TestProject.writeFiles(root, {
    "package.json": JSON.stringify({
      private: true,
      name: "workspace-root",
    }),
    "pnpm-workspace.yaml": "packages:\n  - packages/*\n",
    "packages/shared/package.json": JSON.stringify({
      name: "@scope/shared",
      version: "1.0.0",
      exports: { ".": "./src/index.ts" },
    }),
    "packages/shared/src/index.ts": [
      "export function sharedHelper(value: string): string {",
      "  return value;",
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
        module: "nodenext",
        moduleResolution: "nodenext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src"],
    }),
    "packages/app/src/main.ts": [
      'import { sharedHelper } from "@scope/shared";',
      "export function run(value: string): string {",
      "  return sharedHelper(value);",
      "}",
      "",
    ].join("\n"),
  });

  // No linkWorkspacePackage call: the sibling package exists on disk but is
  // never linked into node_modules, so `@scope/shared` cannot resolve — the
  // shape a Yarn PnP install or an incomplete install presents to the checker.
  const dump = dumpGraph(root, "packages/app/tsconfig.json");
  const run = findNode(dump, {
    file: "packages/app/src/main.ts",
    name: "run",
    kind: "function",
  });

  assert.ok(run, "importing package node survives the unresolved specifier");
  assert.equal(
    dump.nodes.some((node) => node.file.includes("packages/shared")),
    false,
    "unresolved sibling package contributes no nodes",
  );
  assert.equal(
    dump.nodes.some((node) => node.file.includes("node_modules")),
    false,
    "unresolved sibling does not leak a node_modules path",
  );
};
