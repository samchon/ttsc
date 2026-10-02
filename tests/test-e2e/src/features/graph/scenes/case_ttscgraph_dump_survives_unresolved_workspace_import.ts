import fs from "node:fs";
import path from "node:path";

import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  dumpGraph,
  findNode,
} from "../../../internal/graph/internal/graphDump";
import { withIdentityBoundary } from "../../../internal/graph/internal/identityBoundary";
import { assert } from "../../../internal/graph/internal/ttsgraph";

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
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_graph, the exported scene case_ttscgraph_dump_survives_unresolved_workspace_import runs the actual native dump producer on its fixture project; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Actual compiler resolution failure must not destroy usable graph output or invent workspace edges; a synthetic missing node cannot establish native failure tolerance.
 * @evidence contracts/e2e.md#shared-execution The existing identity workspace supplies the physical sibling and original link; all seven original unlinked fixture files temporarily replace its corresponding inputs while a renamed link produces the unlinked state. Changed compiler membership still requires a separate real dump, but no second workspace is allocated.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The owned link is renamed rather than removed; all replaced input bytes or original absence restore finally before its rename back. The separate synchronous CLI dump owns the unlinked producer facts and joins before restoration. The subsequent same-MCP lookup requires the restored linked declaration for later consumers; no intermediate unlinked MCP generation or refresh count is claimed. The experiment joins that MCP after all cases.
 * @evidence contracts/e2e.md#preserved-coverage App presence, shared absence, no alias leakage and successful dump remain. This is not a claim of an installed Yarn PnP connection.
 */
export const case_ttscgraph_dump_survives_unresolved_workspace_import =
  async () => {
    await withIdentityBoundary(async (client, root) => {
      const originals = FixtureFiles.read(
        "graph/ttscgraph_dump_survives_unresolved_workspace_import/inputs-1",
      );
      const originalInputs = Object.keys(originals).map((relative) => {
        const file = path.join(root, relative);
        return {
          file,
          relative,
          bytes: fs.existsSync(file) ? fs.readFileSync(file) : undefined,
        };
      });
      const link = path.join(root, "node_modules/@scope/shared");
      const parkedLink = path.join(root, ".unlinked-shared");
      const linkedTarget = fs.realpathSync.native(link);
      assert.equal(
        fs.existsSync(parkedLink),
        false,
        "the owned link parking location must start absent",
      );
      fs.renameSync(link, parkedLink);
      const primaryFailures: unknown[] = [];
      try {
        for (const { file, relative } of originalInputs)
          fs.writeFileSync(file, originals[relative]!);

        // The original link is parked outside node_modules while this dump runs,
        // so `@scope/shared` cannot resolve through the checker: this is the
        // shape a Yarn PnP install or an incomplete install presents to the checker.
        const dump = dumpGraph(root, "packages/app/tsconfig.json");
        const run = findNode(dump, {
          file: "packages/app/src/main.ts",
          name: "run",
          kind: "function",
        });

        assert.ok(
          run,
          "importing package node survives the unresolved specifier",
        );
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
      } catch (error) {
        primaryFailures.push(error);
        throw error;
      } finally {
        const restorationErrors: unknown[] = [];
        try {
          client.assertInputMutationAllowed();
        } catch (error) {
          throw new AggregateError(
            [...primaryFailures, error],
            "Unlinked reset refused while child completion is unconfirmed",
          );
        }
        for (const restore of [
          ...originalInputs.map(({ file, bytes }) => () => {
            if (bytes !== undefined) fs.writeFileSync(file, bytes);
            else if (fs.existsSync(file)) fs.unlinkSync(file);
          }),
          () => fs.renameSync(parkedLink, link),
        ]) {
          try {
            restore();
          } catch (error) {
            restorationErrors.push(error);
          }
        }
        if (restorationErrors.length) {
          client.preventInputReuse(
            "Unlinked workspace input or link restoration failed",
          );
          throw new AggregateError(
            [...primaryFailures, ...restorationErrors],
            "Unlinked workspace restoration failed",
          );
        }
      }
      assert.equal(
        fs.realpathSync.native(link),
        linkedTarget,
        "restoration must retain the original physical workspace target",
      );
      const recovered = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: {
          question:
            "Find the linked SharedService after restoring workspace inputs.",
          draft: {
            reason:
              "Check restored compiler membership in the same MCP session.",
            type: "lookup",
          },
          review: "Use the current restored workspace.",
          request: { type: "lookup", query: "SharedService" },
        },
      })) as { isError?: boolean; structuredContent?: unknown };
      assert.equal(recovered.isError, undefined, JSON.stringify(recovered));
      assert.match(
        JSON.stringify(recovered.structuredContent ?? {}),
        /SharedService/,
      );
    });
  };
