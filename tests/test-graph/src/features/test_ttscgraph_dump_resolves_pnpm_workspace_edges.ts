import { findEdge, findNode } from "../internal/graphDump";
import { getIdentityDump } from "../internal/identityBoundary";
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
 * @evidence contracts/e2e.md#shared-execution Thirty-two identity entries share one project: twenty-eight borrow one initialized MCP/native session; four producer assertion entries and the installed decoder case borrow one cached public CLI dump (checker uses both). Raw-only selections prepare no MCP. MCP ranking, exact tag queries and tour/hub contrasts select closed source universes; edits and config restoration advance actual generations without fresh clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, citations, aliases, external declarations and a physical workspace link preserve distinctions. MCP/tag scopes and invalid-config recovery restore config bytes finally; tour/hub variants overwrite only their own source and scope include to that file, retaining exact population/order/topology before each native request. Cached CLI facts serve unchanged assertions, and suite finally joins its client after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage All app/shared node checks, nonexternal flags, alias-path exclusions and three relation-kind assertions remain; real link capability is not replaced by a no-op fixture.
 */
export const test_ttscgraph_dump_resolves_pnpm_workspace_edges = async () => {
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
