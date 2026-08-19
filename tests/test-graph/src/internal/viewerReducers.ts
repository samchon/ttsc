import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface ViewerRawNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  external?: boolean;
  ignored?: boolean;
}

export interface ViewerRawDump {
  project: string;
  nodes: ViewerRawNode[];
  edges: { from: string; to: string; kind: string }[];
}

export interface ViewerPayload {
  counts: {
    nodes: number;
    links: number;
    droppedIgnored?: number;
  };
  links?: { source: string; target: string; kind: string }[];
  nodes: { id: string; file: string }[];
}

export type ViewerReduce = (raw: ViewerRawDump) => ViewerPayload;

export interface ViewerReducerCopy {
  /** Short name used in assertion messages. */
  name: string;
  /** Repository-relative path of the copy. */
  file: string;
  reduce: ViewerReduce;
}

/** The repository root, resolved from this module rather than from the cwd. */
export const repositoryRoot = (): string =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

const loadReducer = async (
  relativePath: string,
  exported: "named" | "default" | "namespace",
): Promise<ViewerReduce> => {
  const module = (await import(
    pathToFileURL(path.join(repositoryRoot(), relativePath)).href
  )) as {
    reduce?: ViewerReduce;
    default?: { reduce?: ViewerReduce };
    TtscBenchmarkGraphReduce?: { reduce?: ViewerReduce };
  };
  const reduce =
    exported === "named"
      ? module.reduce
      : exported === "default"
        ? module.default?.reduce
        : module.TtscBenchmarkGraphReduce?.reduce;
  if (typeof reduce !== "function")
    assert.fail(`${relativePath} exports reduce()`);
  return reduce;
};

/**
 * The three production copies of the viewer reduction, loaded from source in
 * reference-first order.
 *
 * `packages/graph/src/reduce.ts` is the reference. The website and the graph
 * benchmark each carry their own copy because neither depends on `@ttsc/graph`,
 * and adding that dependency would be a new build dependency for a browser
 * bundle and for a benchmark package that deliberately has none. Tests are what
 * hold the copies together, so a case pinning shared behavior runs all three.
 */
export const loadViewerReducers = async (): Promise<ViewerReducerCopy[]> => [
  {
    name: "package",
    file: "packages/graph/src/reduce.ts",
    reduce: await loadReducer("packages/graph/src/reduce.ts", "named"),
  },
  {
    name: "website",
    file: "website/src/components/graph/TtscWebsiteGraphReduce.ts",
    reduce: await loadReducer(
      "website/src/components/graph/TtscWebsiteGraphReduce.ts",
      "default",
    ),
  },
  {
    name: "fixture",
    file: "benchmarks/graph/src/TtscBenchmarkGraphReduce.ts",
    reduce: await loadReducer(
      "benchmarks/graph/src/TtscBenchmarkGraphReduce.ts",
      "namespace",
    ),
  },
];
