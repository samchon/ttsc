import { TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { IViteServeCandidateFixture } from "./IViteServeCandidateFixture";

/**
 * Prove the fixture manufactures the missing `node_modules` candidate before
 * any server-level assertion, so a serve scenario cannot pass vacuously when
 * candidate emission changes shape upstream.
 */
export async function assertFixtureDerivesMissingCandidate(
  fixture: IViteServeCandidateFixture,
): Promise<void> {
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  interface IWatchRegistration {
    evidence?: {
      state?: {
        codec: string;
        observation?: {
          accessibleEntries?: { directories: string[]; files: string[] };
          directoryExists?: boolean;
        };
      };
    };
    input: string;
  }
  const watched: IWatchRegistration[] = [];
  await transformTtsc(
    fixture.mainFile,
    fs.readFileSync(fixture.mainFile, "utf8"),
    resolveOptions({ project: path.join(fixture.app, "tsconfig.json") }),
    undefined,
    createTtscTransformCache(),
    {
      addWatchFile: (
        input: string,
        evidence?: IWatchRegistration["evidence"],
      ) => watched.push({ evidence, input }),
    },
  );
  assert.ok(
    watched.some(
      ({ input }) =>
        path.resolve(input) === path.resolve(fixture.missingCandidate),
    ),
    `fixture must derive the missing node_modules candidate as a watch input; watched: ${watched.map(({ input }) => input).join(", ")}`,
  );
  const typeRoot = watched.find(
    ({ input }) => path.resolve(input) === path.resolve(fixture.typeRoot),
  );
  const typeRootObservation =
    typeRoot?.evidence?.state?.codec === "predicates"
      ? typeRoot.evidence.state.observation
      : undefined;
  assert.ok(
    typeRootObservation !== undefined,
    `fixture must preserve the automatic type-root predicates; watched: ${watched.map(({ input }) => input).join(", ")}`,
  );
  assert.equal(
    typeRootObservation.directoryExists,
    true,
    "the automatic type root must preserve its successful directory predicate",
  );
  assert.deepEqual(
    typeRootObservation.accessibleEntries,
    { directories: [], files: [] },
    "the empty automatic type root must preserve its accessible-entry listing",
  );
}
