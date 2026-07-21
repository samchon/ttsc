import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

interface RawNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  external?: boolean;
  ignored?: boolean;
}

interface RawDump {
  project: string;
  nodes: RawNode[];
  edges: { from: string; to: string; kind: string }[];
}

interface ViewerPayload {
  counts: {
    nodes: number;
    links: number;
    droppedIgnored?: number;
  };
  nodes: { id: string; file: string }[];
}

type Reduce = (raw: RawDump) => ViewerPayload;

const loadReducer = async (
  relativePath: string,
  exported: "named" | "default",
): Promise<Reduce> => {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const module = (await import(
    pathToFileURL(path.join(repository, relativePath)).href
  )) as {
    reduce?: Reduce;
    default?: { reduce?: Reduce };
  };
  const reduce = exported === "named" ? module.reduce : module.default?.reduce;
  if (typeof reduce !== "function")
    assert.fail(`${relativePath} exports reduce()`);
  return reduce;
};

const createDump = (files: readonly string[]): RawDump => {
  const nodes = files.map((file, index) => ({
    id: `${file}#symbol${index}:function`,
    name: `symbol${index}`,
    kind: "function",
    file,
  }));
  return {
    project: "fixture",
    nodes,
    edges: nodes.map((node, index) => ({
      from: node.id,
      to: nodes[(index + 1) % nodes.length]!.id,
      kind: "calls",
    })),
  };
};

const assertProjection = (
  reduce: Reduce,
  files: readonly string[],
  expectedFiles: readonly string[],
  label: string,
): void => {
  const result = reduce(createDump(files));
  assert.deepEqual(
    result.nodes.map((node) => node.file),
    expectedFiles,
    `${label}: file projection`,
  );
  assert.deepEqual(
    result.nodes.map((node) => node.id.slice(0, node.id.indexOf("#"))),
    expectedFiles,
    `${label}: id projection`,
  );
};

/**
 * Verifies graph viewer reducers: legacy paths retain filenames.
 *
 * Locks the legacy reroot boundary shared by the package, website, and fixture
 * reducers. The root must be a source directory rather than a complete file;
 * Windows paths compare case-insensitively, POSIX paths remain case-sensitive,
 * and current project-relative dumps must bypass rerooting entirely.
 *
 * 1. Load all three production reducer copies through Node's TypeScript loader.
 * 2. Exercise single-file, repeated-file, nested, POSIX, drive, and UNC paths.
 * 3. Assert IDs and files retain basenames while package/website filters differ.
 */
export const test_ttscgraph_viewer_reducers_preserve_legacy_absolute_filenames =
  async (): Promise<void> => {
    const reducers = [
      {
        name: "package",
        reduce: await loadReducer("packages/graph/src/reduce.ts", "named"),
      },
      {
        name: "website",
        reduce: await loadReducer(
          "website/src/components/graph/TtscWebsiteGraphReduce.ts",
          "default",
        ),
      },
      {
        name: "fixture",
        reduce: await loadReducer(
          "experimental/benchmark/graph/viewer.mjs",
          "named",
        ),
      },
    ];

    const cases = [
      {
        name: "single POSIX file with a self-edge",
        files: ["/work/src/only.ts"],
        expected: ["only.ts"],
      },
      {
        name: "POSIX filesystem-root file",
        files: ["/only.ts"],
        expected: ["only.ts"],
      },
      {
        name: "repeated nodes in one POSIX file",
        files: ["/work/src/only.ts", "/work/src/only.ts"],
        expected: ["only.ts", "only.ts"],
      },
      {
        name: "multiple POSIX files",
        files: ["/work/src/alpha.ts", "/work/src/beta.ts"],
        expected: ["alpha.ts", "beta.ts"],
      },
      {
        name: "nested POSIX files",
        files: ["/work/src/alpha.ts", "/work/src/nested/beta.ts"],
        expected: ["alpha.ts", "nested/beta.ts"],
      },
      {
        name: "case-insensitive Windows drive",
        files: ["C:\\Work\\src\\alpha.ts", "c:\\work\\SRC\\nested\\beta.ts"],
        expected: ["alpha.ts", "nested/beta.ts"],
      },
      {
        name: "case-insensitive Windows drive root",
        files: ["C:\\alpha.ts", "c:\\beta.ts"],
        expected: ["alpha.ts", "beta.ts"],
      },
      {
        name: "case-insensitive Windows UNC share",
        files: [
          "\\\\Server\\Share\\Work\\src\\alpha.ts",
          "\\\\server\\share\\work\\SRC\\nested\\beta.ts",
        ],
        expected: ["alpha.ts", "nested/beta.ts"],
      },
      {
        // On a case-sensitive filesystem `/work` and `/Work` are different
        // roots, so there is no common directory to relativize against. The
        // projection keeps both spellings whole: collapsing them to their
        // basenames gave two distinct files one viewer id, and the reduction
        // rewrites node ids with this string (#822).
        name: "case-sensitive unrelated POSIX roots",
        files: ["/work/src/alpha.ts", "/Work/src/nested/beta.ts"],
        expected: ["/work/src/alpha.ts", "/Work/src/nested/beta.ts"],
      },
      {
        name: "current project-relative paths",
        files: ["src/alpha.ts", "src/nested/beta.ts"],
        expected: ["src/alpha.ts", "src/nested/beta.ts"],
      },
    ] as const;

    for (const reducer of reducers)
      for (const scenario of cases)
        assertProjection(
          reducer.reduce,
          scenario.files,
          scenario.expected,
          `${reducer.name}/${scenario.name}`,
        );

    const authored = "/work/src/authored.ts";
    const generated = "/work/generated/client.ts";
    const policyDump: RawDump = {
      project: "policy",
      nodes: [
        {
          id: `${authored}#authored:function`,
          name: "authored",
          kind: "function",
          file: authored,
        },
        {
          id: `${generated}#generated:function`,
          name: "generated",
          kind: "function",
          file: generated,
          ignored: true,
        },
      ],
      edges: [
        {
          from: `${authored}#authored:function`,
          to: `${authored}#authored:function`,
          kind: "calls",
        },
        {
          from: `${authored}#authored:function`,
          to: `${generated}#generated:function`,
          kind: "calls",
        },
      ],
    };

    const packageResult = reducers[0]!.reduce(policyDump);
    const websiteResult = reducers[1]!.reduce(policyDump);
    assert.deepEqual(
      [packageResult.counts.nodes, packageResult.counts.links],
      [2, 2],
      "package reducer keeps ignored nodes by design",
    );
    assert.deepEqual(
      [
        websiteResult.counts.nodes,
        websiteResult.counts.links,
        websiteResult.counts.droppedIgnored,
      ],
      [1, 1, 1],
      "website reducer drops ignored nodes by design",
    );
  };
