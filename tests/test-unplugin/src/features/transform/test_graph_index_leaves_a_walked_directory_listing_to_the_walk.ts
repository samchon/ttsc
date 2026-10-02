import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { TRANSFORM_RESULT_MEMBERSHIP } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_MEMBERSHIP";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeGraphIndexes";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { isProjectWalkDirectory } from "../../../../../packages/unplugin/src/core/transform/project/isProjectWalkDirectory";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { graphInputObservationFailures } from "../../../../../packages/unplugin/src/core/transform/inputs/graphInputObservationFailures";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

/**
 * Verifies the graph index leaves the listing of a directory the project walk
 * enumerates to the walk, and keeps every other listing the compiler reported.
 *
 * The compiler's observer keeps every predicate anyone asked of a path, so the
 * project root, which the config's file list is expanded from, arrives with its
 * whole listing once it is also a module resolution candidate. Proving that
 * listing failed the generation for every unrelated file a framework wrote
 * beside the project, `.next` and `AGENTS.md` among them: measured on a
 * Turbopack pool, whose workers then compiled the project again each. What the
 * expansion depends on is the program's membership there, which the walk proves
 * only for directories it actually enumerated in a complete capture. A listing
 * the walk does not stand for stays: a
 * directory it never enters, a universal resolution input such as a type root,
 * and a path whose listing is its only predicate.
 *
 * 1. Index an envelope whose root, a directory below it, `dist` (which the
 *    tsconfig's `include: ["src"]` never reaches), a universal input, and a
 *    listing-only path each carry a listing, with the capture's membership
 *    registered from an actual complete collectProjectInputSnapshot.
 * 2. Assert only the walked directories that carry another predicate lose their
 *    listing, and that an envelope captured without a membership keeps all.
 * 3. Contrast an actual directory link the walk skips and a supplied EIO
 *    enumeration failure that grants no partial directory authority.
 * 4. Write a framework's files beside the project, and assert the root's indexed
 *    observation still holds.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual collectProjectInputSnapshot, envelopeGraphIndexes and graphInputObservationFailures. Listings are omitted only for directories enumerated in a complete snapshot; skipped native links, failed enumeration, excluded/universal/listing-only observations and absent membership preserve listings. Unrelated framework writes still do not invalidate the reduced root observation.
 * @evidence contracts/testing.md#independent-expectations Literal directory/file lists come from deliberately authored fixture categories, not the index output. Actual native link Dirent and supplied readdir EIO distinguish policy admission from observed enumeration; incomplete captures cannot authorize even their successfully visited subset. Capture results populate setup, while independent literal listings and membership absence detect unsafe omission.
 * @evidence contracts/testing.md#distinguishing-cases The complete ordinary walk drops root and nested listings but preserves excluded dist, universal src/types, listing-only src/only and a real linked directory. An EIO view fails one admitted directory, leaves it unvisited and preserves its listing plus root and a successfully visited sibling because directory completeness failed. No-marker envelopes preserve every literal listing; later framework writes preserve the reduced root predicate.
 * @evidence contracts/testing.md#execution-ownership One discoverable unit calls the owning snapshot/index/observation operations on real temporary files and a native directory link (junction on Windows). The existing TRANSFORM_RESULT_FILESYSTEM seam supplies only an EIO readdir boundary; TRANSFORM_RESULT_MEMBERSHIP records actual snapshot completeness and visited directories, and both registrations are removed in finally. No compiler, watcher, binary producer or product host runs.
 */
export async function test_graph_index_leaves_a_walked_directory_listing_to_the_walk(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-walked-listing-"),
  );
  TestProject.writeFiles(root, {
    "dist/out.js": "export {};\n",
    "src/lib/util.ts": "export const util = 1;\n",
    "src/unreadable/child.ts": "export {};\n",
    "src/main.ts": 'import "./lib/util";\n',
    "src/only/leaf.ts": "export {};\n",
    "src/types/node/index.d.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const external = fs.realpathSync.native(TestProject.tmpdir("ttsc-unplugin-listing-target-"));
  TestProject.writeFiles(external, { "linked.ts": "export {};\n" });
  const linked = path.join(root, "src", "linked");
  fs.symlinkSync(external, linked, process.platform === "win32" ? "junction" : "dir");
  const linkEntry = fs.readdirSync(path.join(root, "src"), { withFileTypes: true }).find((entry) => entry.name === "linked");
  assert.ok(linkEntry);
  assert.equal(linkEntry.isSymbolicLink(), true, "the actual Dirent reports a link");
  assert.equal(linkEntry.isDirectory(), false, "the actual walk cannot descend through this entry");
  const policy = {
    ...readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
    useCaseSensitiveFileNames: true,
  };
  assert.equal(isProjectWalkDirectory(linked, policy), true, "lexical admission alone does not establish enumeration");
  const snapshot = collectProjectInputSnapshot(root, createHostPathIdentityContext(), DEFAULT_FILESYSTEM_OPERATIONS, undefined, { policy });
  assert.equal(snapshot.directoryComplete, true);
  const visited = new Set(snapshot.projectDirectories.map((directory) => directory.path));
  assert.equal(visited.has(root), true);
  assert.equal(visited.has(path.join(root, "src", "lib")), true);
  assert.equal(visited.has(linked), false, "the policy-admitted link was not enumerated");
  const listing = (directory: string) => {
    const entries = fs.readdirSync(path.join(root, directory), {
      withFileTypes: true,
    });
    return {
      directories: entries.filter((e) => e.isDirectory()).map((e) => e.name),
      files: entries.filter((e) => e.isFile()).map((e) => e.name),
    };
  };
  const listed = (directory: string) => ({
    accessibleEntries: listing(directory),
    directoryExists: true,
  });
  const envelope = () =>
    ({
      graph: {
        candidates: { "src/main.ts": [".", "src/lib", "dist", "src/only", "src/linked", "src/unreadable"] },
        configs: [],
        edges: { "src/main.ts": ["src/lib/util.ts"] },
        globals: [],
        inputObservations: {
          ".": listed("."),
          dist: listed("dist"),
          "src/lib": listed("src/lib"),
          "src/linked": listed("src/linked"),
          "src/unreadable": listed("src/unreadable"),
          "src/only": { accessibleEntries: listing("src/only") },
          "src/types": listed("src/types"),
        },
        resolutionInputs: ["src/types"],
      },
      type: "success",
      typescript: { "src/main.ts": "export {};\n" },
    }) as never;
  const index = (result: object) =>
    envelopeGraphIndexes(
      envelopeDerivation({ projectRoot: root, result: result as never }),
      { projectRoot: root, result: result as never },
    ).inputObservations;
  const listingOf = (
    observations: ReturnType<typeof index>,
    directory: string,
  ) => observations.get(path.join(root, directory))?.accessibleEntries;

  const captured = envelope();
  const failedResult = envelope();
  try {
  TRANSFORM_RESULT_MEMBERSHIP.set(captured, {
    policy,
    enumeratedDirectories: snapshot.directoryComplete ? visited : new Set<string>(),
    projectRoot: root,
  });
  TRANSFORM_RESULT_FILESYSTEM.set(captured, DEFAULT_FILESYSTEM_OPERATIONS);
  const observations = index(captured);
  assert.equal(listingOf(observations, "."), undefined, "the root's listing");
  assert.equal(
    observations.get(root)?.directoryExists,
    true,
    "keeps its other predicates",
  );
  assert.equal(listingOf(observations, "src/lib"), undefined, "a walked child");
  assert.deepEqual(listingOf(observations, "dist"), { directories: [], files: ["out.js"] });
  assert.deepEqual(listingOf(observations, "src/types"), { directories: ["node"], files: [] });
  assert.deepEqual(listingOf(observations, "src/only"), { directories: [], files: ["leaf.ts"] });
  assert.deepEqual(listingOf(observations, "src/linked"), { directories: [], files: ["linked.ts"] }, "an admitted but unwalked link keeps its listing");
  assert.equal(listingOf(observations, "src/unreadable"), undefined, "the ordinary view enumerated this directory");
  const unreadable = path.join(root, "src", "unreadable");
  const failedFilesystem = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    readdir: (directory: string) => {
      if (directory === unreadable) throw Object.assign(new Error("authored enumeration failure"), { code: "EIO" });
      return DEFAULT_FILESYSTEM_OPERATIONS.readdir(directory);
    },
  };
  const failedSnapshot = collectProjectInputSnapshot(root, createHostPathIdentityContext(failedFilesystem), failedFilesystem, undefined, { policy });
  assert.equal(failedSnapshot.directoryComplete, false);
  assert.equal(failedSnapshot.projectDirectories.some((directory) => directory.path === root), true);
  assert.equal(failedSnapshot.projectDirectories.some((directory) => directory.path === path.join(root, "src", "lib")), true, "the partial walk really visited this sibling");
  assert.equal(failedSnapshot.projectDirectories.some((directory) => directory.path === unreadable), false);
  assert.equal(failedSnapshot.walkFailures.some((failure) => failure.path === unreadable && failure.kind === "directory-read-failed"), true);
  TRANSFORM_RESULT_FILESYSTEM.set(failedResult, failedFilesystem);
  TRANSFORM_RESULT_MEMBERSHIP.set(failedResult, {
    policy,
    projectRoot: root,
    enumeratedDirectories: failedSnapshot.directoryComplete
      ? new Set(failedSnapshot.projectDirectories.map((directory) => directory.path))
      : new Set<string>(),
  });
  const failedObservations = index(failedResult);
  assert.deepEqual(listingOf(failedObservations, "src/unreadable"), { directories: [], files: ["child.ts"] }, "failed enumeration cannot erase the compiler's independently reported listing");
  assert.deepEqual(listingOf(failedObservations, "src/lib"), { directories: [], files: ["util.ts"] }, "an incomplete walk grants no partial enumeration authority");
  assert.deepEqual(listingOf(failedObservations, "."), { directories: ["dist", "src"], files: ["tsconfig.json"] });
  const unqualified = index(envelope());
  for (const [directory, expected] of [
    [".", { directories: ["dist", "src"], files: ["tsconfig.json"] }],
    ["src/lib", { directories: [], files: ["util.ts"] }],
    ["src/linked", { directories: [], files: ["linked.ts"] }],
    ["src/unreadable", { directories: [], files: ["child.ts"] }],
    ["dist", { directories: [], files: ["out.js"] }],
    ["src/types", { directories: ["node"], files: [] }],
    ["src/only", { directories: [], files: ["leaf.ts"] }],
  ] as const) {
    assert.deepEqual(listingOf(unqualified, directory), expected, "without membership no listing may be dropped or changed");
  }

  fs.mkdirSync(path.join(root, ".next"));
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# agents\n");
  fs.writeFileSync(path.join(root, "next-env.d.ts"), "export {};\n");
  assert.deepEqual(
    graphInputObservationFailures(
      root,
      observations.get(root)!,
      DEFAULT_FILESYSTEM_OPERATIONS,
      createHostPathIdentityContext(),
    ),
    [],
    "a framework writing beside the project fails nothing",
  );
  } finally {
    TRANSFORM_RESULT_MEMBERSHIP.delete(captured);
    TRANSFORM_RESULT_FILESYSTEM.delete(captured);
    TRANSFORM_RESULT_MEMBERSHIP.delete(failedResult);
    TRANSFORM_RESULT_FILESYSTEM.delete(failedResult);
  }
}
