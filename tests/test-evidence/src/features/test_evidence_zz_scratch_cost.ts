import { performance } from "node:perf_hooks";
import path from "node:path";

import {
  type ITtscEvidenceProject,
  createProject,
  pluginCacheDirectory,
  resolveDependency,
} from "../internal/index";

const require_ = require;

/** Scratch cost probe; not a case. Removed before commit. */
export const test_evidence_zz_scratch_cost = (): void => {
  const sections = Array.from(
    { length: 40 },
    (_, index) => `## Section ${String(index)} {#s${String(index)}}\n\nBody.\n`,
  ).join("\n");
  const project: ITtscEvidenceProject = createProject({
    name: "cost",
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
      "docs/subject.md": `# Subject\n\n${sections}`,
      "src/Sale.ts": [
        "/**",
        " * A sale.",
        " *",
        ...Array.from(
          { length: 40 },
          (_, index) =>
            ` * @evidence docs/subject.md#s${String(index)} Stated here.`,
        ),
        " */",
        "export interface Sale {",
        "  id: string;",
        "}",
        "",
      ].join("\n"),
    },
  });
  const previous = process.env.TTSC_CACHE_DIR;
  process.env.TTSC_CACHE_DIR = pluginCacheDirectory();
  try {
    const { publishArtifacts, artifactsAreStale } = require_(
      path.join(
        resolveDependency("@ttsc/graph"),
        "lib",
        "model",
        "publishedArtifacts.js",
      ),
    ) as {
      publishArtifacts(o: { cwd: string; tsconfig: string }): {
        file: string | null;
        fingerprint: string;
        inputs: unknown;
      };
      artifactsAreStale(p: unknown): boolean;
    };
    const publish: number[] = [];
    let last: ReturnType<typeof publishArtifacts> | undefined;
    for (let index = 0; index < 5; ++index) {
      const started = performance.now();
      last = publishArtifacts({
        cwd: project.directory,
        tsconfig: "tsconfig.json",
      });
      publish.push(Math.round(performance.now() - started));
    }
    const check: number[] = [];
    for (let index = 0; index < 20; ++index) {
      const started = performance.now();
      artifactsAreStale(last);
      check.push(Math.round((performance.now() - started) * 1000));
    }
    publish.sort((a, b) => a - b);
    check.sort((a, b) => a - b);
    console.error("COST publishArtifacts ms:", publish.join(" "));
    console.error("COST artifactsAreStale us:", check.join(" "));
    console.error("COST file:", last?.file);
  } finally {
    if (previous === undefined) delete process.env.TTSC_CACHE_DIR;
    else process.env.TTSC_CACHE_DIR = previous;
    project.cleanup();
  }
};
