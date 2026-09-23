import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TRANSFORM_RESULT_MEMBERSHIP } from "../../../../../packages/unplugin/lib/core/transform/cache/TRANSFORM_RESULT_MEMBERSHIP.js";
import { envelopeDerivation } from "../../../../../packages/unplugin/lib/core/transform/envelope/envelopeDerivation.js";
import { envelopeGraphIndexes } from "../../../../../packages/unplugin/lib/core/transform/envelope/envelopeGraphIndexes.js";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/lib/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS.js";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/lib/core/transform/filesystem/createHostPathIdentityContext.js";
import { graphInputObservationFailures } from "../../../../../packages/unplugin/lib/core/transform/inputs/graphInputObservationFailures.js";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/lib/core/tsconfig/readProjectMembershipPolicy.js";

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
 * under the same policy. A listing the walk does not stand for stays: a
 * directory it never enters, a universal resolution input such as a type root,
 * and a path whose listing is its only predicate.
 *
 * 1. Index an envelope whose root, a directory below it, a directory the policy
 *    excludes, a universal input, and a listing-only path each carry a listing,
 *    with the capture's membership registered.
 * 2. Assert only the walked directories that carry another predicate lose their
 *    listing, and that an envelope captured without a membership keeps all.
 * 3. Write a framework's files beside the project, and assert the root's indexed
 *    observation still holds.
 */
export async function test_graph_index_leaves_a_walked_directory_listing_to_the_walk(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-walked-listing-"),
  );
  TestProject.writeFiles(root, {
    "dist/out.js": "export {};\n",
    "src/lib/util.ts": "export const util = 1;\n",
    "src/main.ts": 'import "./lib/util";\n',
    "src/only/leaf.ts": "export {};\n",
    "src/types/node/index.d.ts": "export {};\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
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
        candidates: { "src/main.ts": [".", "src/lib", "dist", "src/only"] },
        configs: [],
        edges: { "src/main.ts": ["src/lib/util.ts"] },
        globals: [],
        inputObservations: {
          ".": listed("."),
          dist: listed("dist"),
          "src/lib": listed("src/lib"),
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
  TRANSFORM_RESULT_MEMBERSHIP.set(captured, {
    policy: readProjectMembershipPolicy(path.join(root, "tsconfig.json")),
    projectRoot: root,
  });
  const observations = index(captured);
  assert.equal(listingOf(observations, "."), undefined, "the root's listing");
  assert.equal(
    observations.get(root)?.directoryExists,
    true,
    "keeps its other predicates",
  );
  assert.equal(listingOf(observations, "src/lib"), undefined, "a walked child");
  assert.ok(
    listingOf(observations, "dist"),
    "a directory the walk never enters",
  );
  assert.ok(listingOf(observations, "src/types"), "a universal input");
  assert.ok(listingOf(observations, "src/only"), "a listing-only path");
  assert.ok(
    listingOf(index(envelope()), "."),
    "an envelope captured without a membership keeps every listing",
  );

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
}
