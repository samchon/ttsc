import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { IRealNativeEnvelopeFixture } from "./IRealNativeEnvelopeFixture";
import type { RealNativeEnvelopeCache } from "./RealNativeEnvelopeCache";

/** Inspect the actual generation admitted by @ttsc/unplugin. */
export async function assertProductionEnvelope(
  cache: RealNativeEnvelopeCache,
  fixture: IRealNativeEnvelopeFixture,
): Promise<void> {
  assert.equal(cache.size, 1, "one project must own one cached generation");
  const generation = [...cache.values()][0];
  assert.ok(generation, "the first delivery must admit a generation");
  const { result } = await generation;
  assert.equal(result.type, "success");
  assert.ok(result.typescript, "the native host must return TypeScript output");
  for (const file of fixture.modules) {
    const key = findGraphSpelling(
      fixture.root,
      Object.keys(result.typescript),
      file,
    );
    assert.ok(
      key,
      `the native envelope must contain the sibling output ${graphKey(fixture.root, file)}`,
    );
  }
  assert.equal(
    findGraphSpelling(
      fixture.root,
      Object.keys(result.typescript),
      fixture.excludedSource,
    ),
    undefined,
    "an unrelated compiler overlay must not move an inherited configDir outDir to scratch",
  );

  const graph = result.graph;
  assert.ok(
    graph,
    "the production native host must return its reference graph",
  );
  assert.deepEqual(
    graph.inputProofFailures ?? {},
    {},
    "unchanged automatic types in a mixed-case project must retain reusable proofs",
  );
  const candidates = Object.values(graph.candidates ?? {}).flat();
  assert.ok(candidates.length > 0, "the real graph must contain candidates");
  const realized = new Set([
    ...Object.keys(graph.edges),
    ...Object.values(graph.edges).flat(),
    ...graph.globals,
    ...graph.configs,
    ...Object.keys(graph.candidates ?? {}),
  ]);
  const candidateOnly = candidates.filter(
    (candidate) => !realized.has(candidate),
  );
  assert.ok(
    candidateOnly.length > 0,
    "the fixture must produce a candidate that is not a realized graph member",
  );
  const unproven = candidateOnly.find(
    (candidate) =>
      !Object.prototype.hasOwnProperty.call(
        graph.inputHashes ?? {},
        candidate,
      ) &&
      !Object.prototype.hasOwnProperty.call(
        graph.inputRealpaths ?? {},
        candidate,
      ),
  );
  assert.ok(
    unproven,
    "the fixture must produce a predicate-only path with no legacy compiler hash or realpath projection",
  );
  const automaticTypes = findGraphSpelling(
    fixture.root,
    graph.resolutionInputs ?? [],
    fixture.automaticTypesDirectory,
  );
  assert.ok(
    automaticTypes,
    "the production graph must retain automatic type-root membership",
  );
  assert.ok(
    graph.inputObservations?.[automaticTypes]?.accessibleEntries,
    "the automatic type root must carry its compiler-time accessible entries",
  );

  if (fixture.resolutionCorpus) {
    const knownCandidate = findGraphSpelling(
      fixture.root,
      candidates,
      fixture.missingCandidate,
    );
    assert.ok(
      knownCandidate,
      `the real graph must retain the superseding package candidate ${graphKey(fixture.root, fixture.missingCandidate)}`,
    );
    assert.equal(fs.existsSync(fixture.missingCandidate), false);
  }

  const fileCandidateDirectory = findGraphSpelling(
    fixture.root,
    candidates,
    fixture.fileCandidateDirectory,
  );
  assert.ok(
    fileCandidateDirectory,
    `the real graph must retain the file probe for ${graphKey(fixture.root, fixture.fileCandidateDirectory)}`,
  );
  assert.equal(fs.statSync(fixture.fileCandidateDirectory).isDirectory(), true);
  assert.equal(
    graph.inputObservations?.[fileCandidateDirectory]?.fileExists,
    false,
    "an existing directory must remain a failed file predicate on the production wire",
  );

  if (fixture.resolutionCorpus) {
    for (const [owner, expected] of Object.entries(
      fixture.resolutionCandidateGroups,
    )) {
      for (const file of expected) {
        const candidate = findGraphSpelling(fixture.root, candidates, file);
        assert.ok(
          candidate,
          `the real ${owner} resolver must retain ${graphKey(fixture.root, file)}`,
        );
        assert.equal(
          graph.inputObservations?.[candidate]?.fileExists,
          false,
          `the real ${owner} probe must carry its failed file predicate for ${graphKey(fixture.root, file)}`,
        );
      }
    }
  }

  const declaration = findGraphSpelling(
    fixture.root,
    Object.values(graph.edges).flat(),
    fixture.declaration,
  );
  assert.ok(
    declaration,
    `the selected declaration must be a realized edge: ${graphKey(fixture.root, fixture.declaration)}`,
  );
  assert.match(
    graph.inputHashes?.[declaration] ?? "",
    /^[0-9a-f]{64}$/,
    "the selected declaration must carry a compiler content proof",
  );
  assert.equal(
    typeof graph.inputRealpaths?.[declaration],
    "string",
    "the selected declaration must carry a compiler realpath proof",
  );
}

/** Find the producer's spelling for one semantic filesystem path. */
function findGraphSpelling(
  root: string,
  spellings: readonly string[],
  file: string,
): string | undefined {
  const expected = comparablePath(file);
  return spellings.find(
    (spelling) =>
      comparablePath(graphAbsolutePath(root, spelling)) === expected,
  );
}

/** Resolve one relative-or-absolute graph key to a native absolute path. */
function graphAbsolutePath(root: string, spelling: string): string {
  const native = spelling.split("/").join(path.sep);
  return path.resolve(
    path.isAbsolute(native) ? native : path.join(root, native),
  );
}

/** Apply the host filesystem's path-case contract for semantic comparisons. */
function comparablePath(file: string): string {
  const resolved = physicalPath(file);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Resolve aliases even when the final candidate does not exist yet. */
function physicalPath(file: string): string {
  let existing = path.resolve(file);
  const missing: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missing.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    existing = fs.realpathSync.native(existing);
  } catch {
    // The lexical root is still the only usable identity on an unreadable path.
  }
  return path.resolve(existing, ...missing);
}

/** Convert an absolute fixture path into the native envelope's key vocabulary. */
function graphKey(root: string, file: string): string {
  const relative = path.relative(root, file);
  const selected =
    relative !== "" &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== ".." &&
    !path.isAbsolute(relative)
      ? relative
      : path.resolve(file);
  return selected.split(path.sep).join("/");
}
