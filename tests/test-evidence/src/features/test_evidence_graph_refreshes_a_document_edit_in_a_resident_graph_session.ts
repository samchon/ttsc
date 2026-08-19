import fs from "node:fs";
import path from "node:path";

import {
  type ITtscEvidenceProject,
  createProject,
  pluginCacheDirectory,
  resolveDependency,
} from "../internal/index";

const require_ = require;

/**
 * The address the citation names, held stable by an explicit anchor.
 *
 * The heading text is what the edit changes; the address is what the source
 * cites. Letting the address move with the text would break the citation, and a
 * rule that fails withholds its artifacts by design — so the graph would go
 * empty and the case would prove nothing about the refresh.
 */
const ADDRESS = "docs/subject.md#coupon-stacking";

/** The heading the fixture starts with, and the one it is renamed to. */
const BEFORE = "Coupon stacking";
const AFTER = "Coupon layering across issuers";

const document = (heading: string): string =>
  [
    "# Subject",
    "",
    `## ${heading} {#coupon-stacking}`,
    "",
    "Only one coupon per issuer.",
    "",
  ].join("\n");

/**
 * Verifies a Markdown heading edit reaches a resident graph session.
 *
 * Every other case that touches artifact nodes builds the dump by hand, which
 * proves the projection and nothing about the chain that fills it: the rule
 * selecting units, the sidecar answering the `graph-nodes` verb, the launcher
 * writing them, and the resident producer applying them. This drives all of it
 * against the real toolchain, and that is not a formality — it is the only
 * arrangement in which a sidecar can be missing an argument, or a rule can fail
 * to resolve its project root, and the symptom of both is an empty answer that
 * a synthetic fixture would have produced too.
 *
 * The refresh is the point rather than the initial answer. The documents behind
 * an artifact are deliberately not Program inputs — that is what keeps a
 * Markdown edit from costing a typecheck — so nothing the compiler watches
 * moves when the heading does, and a session that did not watch them separately
 * went on answering with the heading the document used to have for as long as
 * the editor stayed open.
 *
 * 1. Build a real project whose rule publishes a document's H2 sections.
 * 2. Take a graph through a resident session and read the section's node.
 * 3. Rename the heading in the document alone, touching no source and leaving the
 *    anchor the citation names in place.
 * 4. Take another graph from the same session and require the node to carry the
 *    new heading.
 */
export const test_evidence_graph_refreshes_a_document_edit_in_a_resident_graph_session =
  async (): Promise<void> => {
    const project: ITtscEvidenceProject = createProject({
      name: "graph-refresh",
      // `src` alone, where the suite default also compiles `lint.config.ts`.
      // That config imports `@ttsc/evidence`, whose declarations live in the
      // linked workspace package — on this repository's drive, while the fixture
      // is on the OS temp drive — and a Program spanning two filesystem roots is
      // a shape no consumer has, because a consumer's dependency sits inside its
      // own project. The rule reads its configuration itself; it does not need
      // the compiler to.
      include: ["src"],
      lintConfig: [
        'import type { ITtscLintConfig } from "@ttsc/lint";',
        'import { evidence, type ITtscEvidenceGraphConfig } from "@ttsc/evidence";',
        "",
        "const graph: ITtscEvidenceGraphConfig = {",
        "  claims: [",
        "    {",
        '      name: "sale-types",',
        '      type: "typescript",',
        '      files: ["src/Sale.ts"],',
        '      symbol: "type",',
        "      reference: {",
        '        type: "markdown",',
        '        files: ["docs/subject.md"],',
        '        symbol: "h2",',
        "      },",
        "    },",
        "  ],",
        "};",
        "",
        "export default {",
        "  plugins: { evidence },",
        '  rules: { "evidence/graph": ["error", graph] },',
        "} satisfies ITtscLintConfig;",
        "",
      ].join("\n"),
      files: {
        "docs/subject.md": document(BEFORE),
        "src/Sale.ts": [
          "/**",
          " * A sale.",
          " *",
          ` * @evidence ${ADDRESS} States the per-issuer limit.`,
          " */",
          "export interface Sale {",
          "  id: string;",
          "}",
          "",
        ].join("\n"),
      },
    });

    // The plugin cache is the suite's, not the fixture's: a fresh node_modules
    // per case would otherwise pay the cold Go link every time.
    const previousCache = process.env.TTSC_CACHE_DIR;
    process.env.TTSC_CACHE_DIR = pluginCacheDirectory();

    const { TtscGraphSession } = require_(
      path.join(resolveDependency("@ttsc/graph"), "lib", "index.js"),
    ) as { TtscGraphSession: new (options: IOptions) => ISession };

    const session = new TtscGraphSession({
      binary: resolveGraphBinary(),
      cwd: project.directory,
      tsconfig: "tsconfig.json",
    });
    try {
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
      // still passes — a failing rule withholds its artifacts by design, and an
      // empty graph would prove nothing about the refresh.
      fs.writeFileSync(
        path.join(project.directory, "docs", "subject.md"),
        document(AFTER),
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
    } finally {
      session.close();
      if (previousCache === undefined) delete process.env.TTSC_CACHE_DIR;
      else process.env.TTSC_CACHE_DIR = previousCache;
      project.cleanup();
    }
  };

interface IOptions {
  cwd: string;
  tsconfig: string;
  binary?: string;
}

interface ISession {
  graph(): Promise<{ node(id: string): { name: string } | undefined }>;
  close(): void;
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
