import { findEdge, findNode } from "../../../internal/graph/internal/graphDump";
import { getIdentityDump } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_dump_resolves_pnpm_workspace_edges borrows the identity project's cached actual public CLI dump and checks its native producer facts; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Native resolver/checker output must cross the real workspace link and preserve canonical paths; a path string or mocked symlink predicate cannot prove that filesystem connection.
 * @evidence contracts/e2e.md#shared-execution This read-only producer observer borrows the identity project's one cached actual CLI dump. Preparing that dump does not start the MCP client used by neighboring identity consumers. The real authored junction or directory symlink preserves the workspace resolution input, but is not proof that pnpm installed a packed package; built workspace decoders and the explicit native binary supply this boundary. Shared source/cache inputs do not certify actual cache hits, same Program objects or total construction/process counts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This observer changes no source, config, physical workspace link or dump contents. Original sibling-source paths and node_modules alias exclusions remain distinct, and captured CLI facts are consumed only for unchanged producer assertions. Neighboring mutable consumers must settle requests before restoring inputs; unconfirmed readers withdraw shared input reuse and retain the project and external receipt inputs until actual child joins are attempted.
 * @evidence contracts/e2e.md#preserved-coverage All app/shared node checks, nonexternal flags, alias-path exclusions and three relation-kind assertions remain; real link capability is not replaced by a no-op fixture.
 */
export const case_ttscgraph_dump_resolves_pnpm_workspace_edges = async () => {
  const dump = await getIdentityDump();
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
