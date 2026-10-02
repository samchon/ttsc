import assert from "node:assert/strict";

import type { ViewerRawDump, ViewerReduce } from "../internal/viewerReducers";
import { loadViewerReducers } from "../internal/viewerReducers";

const createDump = (files: readonly string[]): ViewerRawDump => {
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
  reduce: ViewerReduce,
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
  assert.equal(
    new Set(result.nodes.map((node) => node.id)).size,
    new Set(files.map((file, index) => `${file}\0${index}`)).size,
    `${label}: distinct source nodes retain distinct projected ids`,
  );
  assert.equal(result.links?.length, files.length, `${label}: links survive`);
  const ids = expectedFiles.map((file, index) => `${file}#symbol${index}:function`);
  assert.deepEqual(
    result.links?.map(({ source, target }) => [source, target]),
    ids.map((id, index) => [id, ids[(index + 1) % ids.length]]),
    `${label}: rewritten edge endpoints retain their authored cycle`,
  );
};

/**
 * Verifies graph viewer reducers: legacy paths retain filenames.
 *
 * Locks the legacy reroot boundary shared by the package, website, and fixture
 * reducers. The root must be a source directory rather than a complete file;
 * Windows volume roots compare case-insensitively, directory spelling and POSIX paths remain case-sensitive,
 * and current project-relative dumps must bypass rerooting entirely.
 *
 * 1. Load all three production reducer copies through Node's TypeScript loader.
 * 2. Exercise single-file, repeated-file, nested, POSIX, drive, and UNC paths.
 * 3. Assert all three reducers retain IDs, files and links, then check the
 *    reducers' git-ignored drop counts.
 *
 * @evidence contracts/testing.md#behavioral-verification All three authored reducers preserve literal file/id projections, distinct identities and links. Each reducer additionally drops the git-ignored generated node, reporting a drop count of one and keeping the authored node with its self edge.
 * @evidence contracts/testing.md#independent-expectations Legacy rerooting retains filenames and current relative spelling; literal fixture projections independently specify POSIX, drive and UNC expectations.
 * @evidence contracts/testing.md#distinguishing-cases Single, repeated and nested files, disjoint/case-distinct roots, drive/UNC paths, relative paths and generated nodes distinguish projection and filter policies.
 * @evidence contracts/testing.md#execution-ownership The named exported src/features entry calls authored operations through the unit loader; fixtures are in-memory and no installed artifact, native build or product process is needed.
 */
export async function test_ttscgraph_viewer_reducers_preserve_legacy_absolute_filenames(): Promise<void> {
    const reducers = await loadViewerReducers();

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
        name: "ambiguous Windows drive directories preserve spelling",
        files: ["C:\\Work\\src\\alpha.ts", "c:\\work\\SRC\\nested\\beta.ts"],
        expected: ["Work/src/alpha.ts", "work/SRC/nested/beta.ts"],
      },
      {
        name: "case-insensitive Windows drive root",
        files: ["C:\\alpha.ts", "c:\\beta.ts"],
        expected: ["alpha.ts", "beta.ts"],
      },
      {
        name: "ambiguous Windows UNC directories preserve spelling",
        files: [
          "\\\\Server\\Share\\Work\\src\\alpha.ts",
          "\\\\server\\share\\work\\SRC\\nested\\beta.ts",
        ],
        expected: ["Work/src/alpha.ts", "work/SRC/nested/beta.ts"],
      },
      {
        name: "case-distinct Windows drive paths remain injective",
        files: ["C:\\work\\src\\same.ts", "c:\\Work\\src\\same.ts"],
        expected: ["work/src/same.ts", "Work/src/same.ts"],
      },
      {
        name: "case-distinct Windows UNC paths remain injective",
        files: [
          "\\\\Server\\Share\\work\\src\\same.ts",
          "\\\\server\\share\\Work\\src\\same.ts",
        ],
        expected: ["work/src/same.ts", "Work/src/same.ts"],
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
    const policyDump: ViewerRawDump = {
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

    // All three copies drop git-ignored generated code, and report how much they
    // dropped. This assertion used to record the package copy keeping it "by
    // design", which was the divergence #835 named: the package copy's own doc
    // comment, the shipped guide, and the two sibling copies all said the
    // authored graph is what a view shows, and only the code disagreed.
    for (const reducer of reducers) {
      const result = reducer.reduce(policyDump);
      assert.deepEqual(
        [
          result.counts.nodes,
          result.counts.links,
          result.counts.droppedIgnored,
        ],
        [1, 1, 1],
        `${reducer.name} reducer drops ignored nodes and reports the drop`,
      );
    }
}
