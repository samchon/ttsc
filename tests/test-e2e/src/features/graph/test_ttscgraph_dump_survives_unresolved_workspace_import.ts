import { FixtureFiles } from "../../internal/FixtureFiles";
import { TestProject } from "@ttsc/testing";

import { dumpGraph, findNode } from "../../internal/graph/internal/graphDump";
import { assert } from "../../internal/graph/internal/ttsgraph";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Real dump succeeds and retains the app node when a shared workspace package is on disk but unlinked, without publishing its unresolved declarations or node_modules aliases.
 * @evidence contracts/testing.md#independent-expectations Physical absence of the package link and literal app/shared names independently define the expected incomplete resolution; the helper requires successful dump status.
 * @evidence contracts/testing.md#distinguishing-cases An unlinked workspace import contrasts the linked workspace case, and local unrelated facts must survive while unresolved targets remain absent.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_dump_survives_unresolved_workspace_import runs the actual native dump producer on its fixture project; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler resolution failure must not destroy usable graph output or invent workspace edges; a synthetic missing node cannot establish native failure tolerance.
 * @evidence contracts/e2e.md#shared-execution One unlinked workspace fixture and native dump reuse the suite compiler. It could share producer preparation with a controlled link transition, but that batching has not been implemented.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The project deliberately never creates the dependency link, preserving the unresolved state without ambient installation; synchronous dump joins and tracked fixture cleanup owns removal.
 * @evidence contracts/e2e.md#preserved-coverage App presence, shared absence, no alias leakage and successful dump remain. This is not a claim of an installed Yarn PnP connection.
 */
export const test_ttscgraph_dump_survives_unresolved_workspace_import = () => {
  const root = TestProject.tmpdir("ttsc-graph-unresolved-");
  TestProject.writeFiles(root, FixtureFiles.read("graph/ttscgraph_dump_survives_unresolved_workspace_import/inputs-1"));

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
