import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { EvidenceProcessOwnership } from "../../../../../utils/src/evidence/EvidenceProcessOwnership";
import { FixtureFiles } from "../../../internal/FixtureFiles";
import {
  type ITtscEvidenceProject,
  pluginCacheDirectory,
  resolveDependency,
} from "../../../internal/evidence/internal/index";
import { TransitionProject } from "../../../internal/evidence/internal/TransitionProject";

const require_ = createRequire(import.meta.url);

/**
 * The address the citation names, held stable by an explicit anchor.
 *
 * The heading text is what the edit changes; the address is what the source
 * cites. Letting the address move with the text would break the citation, and a
 * rule that fails withholds its artifacts by design, so the graph would go
 * empty and the case would prove nothing about the refresh.
 */
const ADDRESS = "docs/subject.md#coupon-stacking";

/** The heading the fixture starts with, and the one it is renamed to. */
const BEFORE = "Coupon stacking";
const AFTER = "Coupon layering across issuers";

/**
 * Verifies a Markdown heading edit reaches a resident graph session.
 *
 * Hand-authored artifact dumps prove the projection without the chain that
 * fills it: the rule selecting units, the sidecar answering the `graph-nodes`
 * verb, the launcher writing them, and the resident producer applying them.
 * This drives all of it against the real toolchain; it is the only arrangement
 * in which a sidecar can be missing an argument, or a rule can fail to resolve
 * its project root, and the symptom of both is an empty answer that a synthetic
 * fixture would have produced too.
 *
 * The refresh is the point rather than the initial answer. The documents behind
 * an artifact are deliberately not Program inputs, so nothing the compiler
 * watches moves when the heading does, and a session that did not watch them
 * separately went on answering with the heading the document used to have.
 *
 * 1. Install a project whose rule publishes a document's H2 sections.
 * 2. Take a graph through a resident session and read the section's node.
 * 3. Rename the heading in the document alone, touching no source and leaving the
 *    anchor the citation names in place.
 * 4. Take another graph from the same session and require the node to carry the
 *    new heading.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads a real resident graph node at a fixed coupon-stacking anchor, changes only its heading and requires the same node to carry the new name.
 * @evidence contracts/testing.md#independent-expectations The authored BEFORE/AFTER headings and fixed ADDRESS independently distinguish stale projection from refreshed document content.
 * @evidence contracts/testing.md#distinguishing-cases Initial and renamed positive nodes must exist; stable anchor avoids confusing a broken citation with refresh, and no graph reload-count assertion is present.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_evidence, which is discovered under src/features and selected by tests/test-e2e/evidence.config.json; this scenario is an exported case function selected by the same claim and loads the real graph package with its own resident native session.
 * @evidence contracts/e2e.md#necessary-boundary Real native graph session, lint sidecar and document watcher/projection connect artifact edits outside Program inputs to graph responses.
 * @evidence contracts/e2e.md#shared-execution Runs in the experiment's single linked consumer and native cache. One resident session serves both graph requests; the compiler source population is unchanged between them.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The session is closed and its joined-close promise awaited before the experiment cleans the consumer; the process environment is restored in finally, and an unjoined session retains the project through EvidenceProcessOwnership instead of letting cleanup race it.
 * @evidence contracts/e2e.md#preserved-coverage The initial node presence and name, post-edit presence and name assertions, and the joined close check remain unchanged.
 */
export async function case_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session(
  project: ITtscEvidenceProject,
): Promise<void> {
  const { "lint.config.ts": lintConfig, ...files } = FixtureFiles.read(
    "evidence/transitions/resident-document",
  );
  // `src` alone, where the default also compiles `lint.config.ts`. That config
  // imports `@ttsc/evidence`, whose declarations live in the linked workspace
  // package, while the fixture is in the OS temp directory. The rule reads its
  // configuration independently.
  TransitionProject.enter(project, { include: ["src"], lintConfig: lintConfig!, files });

  // The plugin cache is the suite's, not the fixture's: a fresh node_modules
  // per case would otherwise pay the cold Go link every time.
  const previousCache = process.env.TTSC_CACHE_DIR;
  let session: ISession | undefined;
  const failures: unknown[] = [];
  try {
    process.env.TTSC_CACHE_DIR = pluginCacheDirectory(project.directory);
    const { TtscGraphSession } = require_(
      path.join(resolveDependency("@ttsc/graph"), "lib", "index.js"),
    ) as { TtscGraphSession: new (options: IOptions) => ISession };

    session = new TtscGraphSession({
      binary: resolveGraphBinary(),
      cwd: project.directory,
      tsconfig: "tsconfig.json",
    });
    const initial = await session.graph();
    const before = initial.node(ADDRESS);
    if (before === undefined)
      throw new Error(
        `${ADDRESS}: the section the rule publishes never reached the graph, so nothing between the rule and the producer is wired`,
      );
    if (!before.name.includes(BEFORE))
      throw new Error(
        `${ADDRESS}: the node is named ${JSON.stringify(before.name)}, which does not carry the heading it stands for`,
      );

    // Only the document changes. No source is touched, so no compiler input
    // moves, and the anchor the citation names is left in place so the rule
    // still passes: a failing rule withholds its artifacts by design, and an
    // empty graph would prove nothing about the refresh.
    EvidenceProcessOwnership.assertAvailable(project.directory);
    fs.writeFileSync(
      path.join(project.directory, "docs", "subject.md"),
      files["docs/subject.md"]!.replace(BEFORE, AFTER),
      "utf8",
    );

    const refreshed = await session.graph();
    const after = refreshed.node(ADDRESS);
    if (after === undefined)
      throw new Error(
        `${ADDRESS}: the section disappeared from the graph after a document edit that kept it`,
      );
    if (!after.name.includes(AFTER))
      throw new Error(
        `${ADDRESS}: the node is still named ${JSON.stringify(after.name)}; the session answered from the set it read at startup`,
      );
  } catch (error) {
    failures.push(error);
  } finally {
    try {
      if (session !== undefined) {
        const closure = session.close();
        if (!(closure instanceof Promise))
          throw new Error(
            "The loaded graph session must expose its actual joined-close promise.",
          );
        await closure;
      }
    } catch (error) {
      failures.push(error);
      try {
        EvidenceProcessOwnership.retain(project.directory, error);
      } catch (retentionError) {
        failures.push(retentionError);
      }
    }
    if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previousCache;
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(failures, "Graph refresh and cleanup failed.");
}

interface IOptions {
  cwd: string;
  tsconfig: string;
  binary?: string;
}

interface ISession {
  graph(): Promise<{ node(id: string): { name: string } | undefined }>;
  close(): Promise<void>;
}

/** The `ttscgraph` this checkout built, which is what the session must drive. */
const resolveGraphBinary = (): string => {
  const override = process.env.TTSC_GRAPH_BINARY;
  if (override !== undefined && path.isAbsolute(override)) return override;
  return path.join(
    resolveDependency("ttsc").replace(
      `${path.sep}packages${path.sep}ttsc`,
      `${path.sep}packages${path.sep}ttsc-${process.platform}-${process.arch}`,
    ),
    "bin",
    process.platform === "win32" ? "ttscgraph.exe" : "ttscgraph",
  );
};
