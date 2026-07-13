// The graph benchmark's corpus: which repositories it measures, where their
// fixture clones live, and which tsconfig each one is indexed through.
//
// The fixtures are forks pinned to a `graph` branch, so a fixture cannot drift
// with upstream between one measurement and the next. Their tsconfigs differ:
// some carry a `tsconfig.graph.json` written for the benchmark, some are
// indexed through the project's own tsconfig, and VS Code's program lives under
// `src/`.
import path from "node:path";

/** Every repository the graph benchmark measures, smallest program first. */
export const GRAPH_CORPUS = [
  "zod",
  "rxjs",
  "vue",
  "nestjs",
  "shopping-backend",
  "excalidraw",
  "typeorm",
  "vscode",
];

const TSCONFIG = {
  zod: "tsconfig.graph.json",
  rxjs: "tsconfig.graph.json",
  vue: "tsconfig.graph.json",
  nestjs: "tsconfig.graph.json",
  "shopping-backend": "tsconfig.graph.json",
  excalidraw: "tsconfig.json",
  typeorm: "tsconfig.json",
  vscode: "src/tsconfig.json",
};

/** Where the `graph`-branch fixture clones live. */
export const GRAPH_WORKDIR =
  process.env.TTSC_GRAPH_BENCH_WORKDIR ??
  "D:/github/samchon/graph-benchmark-work";

export function repoDirOf(repo) {
  return path.join(GRAPH_WORKDIR, `${repo}@graph`);
}

export function tsconfigOf(repo) {
  const tsconfig = TSCONFIG[repo];
  if (tsconfig === undefined)
    throw new Error(
      `unknown graph benchmark repo ${repo}; corpus is ${GRAPH_CORPUS.join(", ")}`,
    );
  return tsconfig;
}
