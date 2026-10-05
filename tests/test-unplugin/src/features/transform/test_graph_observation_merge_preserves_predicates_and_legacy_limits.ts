import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { envelopeGraphIndexes } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeGraphIndexes";
import { graphInputObservationCompatible } from "../../../../../packages/unplugin/src/core/transform/envelope/graphInputObservationCompatible";
import { legacyProjectionOfGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/legacyProjectionOfGraphInputObservation";
import { mergeGraphInputObservations } from "../../../../../packages/unplugin/src/core/transform/envelope/mergeGraphInputObservations";
import { normalizeGraphInputObservation } from "../../../../../packages/unplugin/src/core/transform/envelope/normalizeGraphInputObservation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { removeCaptureScratch } from "../../../../../packages/unplugin/src/core/transform/generation/removeCaptureScratch";
import { compilerInputRealpathObservation } from "../../../../../packages/unplugin/src/core/transform/inputs/compilerInputRealpathObservation";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { captureExternalInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/validation/captureExternalInputSnapshot";
import { compilerGraphInputProofFailures } from "../../../../../packages/unplugin/src/core/transform/validation/compilerGraphInputProofFailures";
import { evidencedWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/evidencedWatchInput";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies repeated graph observations combine only consistent predicates and
 * retain the weaker meaning of their legacy projection.
 *
 * Normalization precedes merging in the actual envelope owner. Empty listings
 * and failed reads do not establish absence; a legacy null is therefore a lossy
 * projection, never a replacement for replaying the original predicates.
 *
 * 1. Combine complementary file predicates and equal repeated observations.
 * 2. Reject conflicting duplicates, changed list order and cross-predicate
 *    contradictions while preserving consistent input records.
 * 3. Compare literal missing/readable/directory and unavailable projections.
 * 4. Replay rich candidate facts against actual files, preserve public not-file
 *    evidence and reject contradictory legacy representations without reading
 *    content for a file-existence-only predicate; after refused watch
 *    registration, replay unchanged candidates and distinguish appearance.
 * 5. Release an owned scratch wrapper without invalidating persistent graph
 *    inputs, including malformed/conflicting scratch facts. The original config
 *    and a same-prefix sibling remain independently validated.
 * 6. Preserve a proof failure on one lexical alias even when another spelling of
 *    the same native file has an independently recorded successful proof.
 *
 * @evidence contracts/testing.md#behavioral-verification Directly calls normalization, mergeGraphInputObservations, graphInputObservationCompatible and legacyProjectionOfGraphInputObservation. Asserts all six repeated predicates agree or reject, complementary predicates merge, incompatible cross-fields reject and legacy encoding preserves exact supported outputs/failure kinds. Actual envelope indexing, compilerGraphInputProofFailures, captureExternalInputSnapshot and evidencedWatchInput preserve rich speculative predicates/public not-file evidence, reject legacy contradictions and avoid candidate content reads for existence-only observations.
 * @evidence contracts/testing.md#independent-expectations Authored file/directory/missing facts, ordered entry lists, distinct literal hashes and absolute POSIX targets define equality/conflict expectations. Independent Node SHA-256 of the documented directory marker and native file bytes defines legacy digests. Literal graph/proof-conflict path/detail expectations and exact candidate-only read counters distinguish representations without generating expected classifications from the validator.
 * @evidence contracts/testing.md#distinguishing-cases All six duplicate fields contrast equal and different values; equal normalized read-field order contrasts changed directory-list order. Empty lists/failed reads remain compatible unknowns, while successful reads, listings and stat/existence contradictions reject. Projection separates null-negative, readable, directory, missing realpath, missing content and unsupported observations; inputs remain unchanged. Rich-only file-existence facts contrast readable rich facts with a contradictory legacy hash and unprojectable rich facts with a supplied legacy proof; present and absent native candidates retain distinct public evidence. Actual tracker registration throws ENOSPC and remains failed; explicitly invoked validator replay probes unchanged candidates without content reads, rejects appearance and recovers after removal. This does not certify the coordinator's automatic replay routing or native capture counts.
 * @evidence contracts/testing.md#execution-ownership One source unit calls actual production operations in process on caller-owned normalized records and a native temporary file corpus. The existing result filesystem capability counts only candidate content reads and forwards native operations. Authored envelope facts exercise index, external capture, compiler proof validation and watch evidence, not native compiler acquisition, retry-loop I/O formulas, observers, peers, sessions or process transport.
 */
export async function test_graph_observation_merge_preserves_predicates_and_legacy_limits(): Promise<void> {
  type Observation = ITtscCompilerTransformation.IInputObservation;
  const hash = "0".repeat(64);
  const otherHash = "1".repeat(64);
  const normalize = (value: unknown): Observation => {
    const actual = normalizeGraphInputObservation(value, "linux");
    assert.ok(
      actual,
      "the authored operand is a supported normalized observation",
    );
    return actual;
  };
  const left = normalize({
    fileExists: true,
    directoryExists: false,
    stat: "file",
  });
  const right = normalize({
    readFile: { ok: true, hash },
    realpath: { ok: true, path: "/physical/input.ts" },
  });
  const merged = mergeGraphInputObservations(left, right);
  assert.deepEqual(merged, {
    fileExists: true,
    directoryExists: false,
    stat: "file",
    readFile: { hash, ok: true },
    realpath: { ok: true, path: "/physical/input.ts" },
  });
  assert.equal(graphInputObservationCompatible(merged!), true);
  assert.deepEqual(left, {
    fileExists: true,
    directoryExists: false,
    stat: "file",
  });
  assert.deepEqual(right, {
    readFile: { hash, ok: true },
    realpath: { ok: true, path: "/physical/input.ts" },
  });

  const duplicates: [string, Observation, Observation][] = [
    ["fileExists", { fileExists: true }, { fileExists: false }],
    ["directoryExists", { directoryExists: true }, { directoryExists: false }],
    ["stat", { stat: "file" }, { stat: "directory" }],
    [
      "readFile",
      { readFile: { ok: true, hash } },
      { readFile: { ok: true, hash: otherHash } },
    ],
    [
      "realpath",
      { realpath: { ok: true, path: "/physical/a" } },
      { realpath: { ok: true, path: "/physical/b" } },
    ],
    [
      "accessibleEntries",
      {
        accessibleEntries: {
          directories: ["z", "a"],
          files: ["last", "first"],
        },
      },
      {
        accessibleEntries: {
          directories: ["a", "z"],
          files: ["last", "first"],
        },
      },
    ],
  ];
  for (const [name, first, different] of duplicates) {
    const normalized = normalize(first);
    const identical = normalize(first);
    assert.deepEqual(
      mergeGraphInputObservations(normalized, identical),
      normalized,
      name + ": equal duplicate",
    );
    assert.equal(
      mergeGraphInputObservations(normalized, normalize(different)),
      undefined,
      name + ": conflicting duplicate",
    );
    assert.deepEqual(
      normalized,
      identical,
      name + ": merger leaves input unchanged",
    );
  }
  assert.deepEqual(
    mergeGraphInputObservations(
      normalize({ readFile: { ok: true, hash } }),
      normalize({ readFile: { hash, ok: true } }),
    ),
    { readFile: { hash, ok: true } },
    "normalization fixes property order before repeated comparisons",
  );
  for (const [first, second] of [
    [{ fileExists: true }, { directoryExists: true }],
    [{ readFile: { ok: true, hash } }, { stat: "directory" }],
    [{ stat: "missing" }, { fileExists: true }],
    [
      { accessibleEntries: { directories: ["child"], files: [] } },
      { fileExists: true },
    ],
  ] satisfies Array<[Observation, Observation]>) {
    assert.equal(
      mergeGraphInputObservations(normalize(first), normalize(second)),
      undefined,
    );
    assert.equal(
      graphInputObservationCompatible({ ...first, ...second }),
      false,
    );
  }
  const weak = {
    accessibleEntries: { directories: [], files: [] },
    readFile: { ok: false as const },
  };
  assert.equal(graphInputObservationCompatible(weak), true);
  assert.deepEqual(
    mergeGraphInputObservations(
      normalize({ accessibleEntries: weak.accessibleEntries }),
      normalize({ readFile: weak.readFile }),
    ),
    weak,
  );

  const directoryHash = createHash("sha256")
    .update("ttsc:host-input:directory\0")
    .digest("hex");
  const projections: [string, Observation, object][] = [
    ["known missing", { stat: "missing" }, { hash: null, realpath: null }],
    [
      "negative file predicate is lossy",
      { fileExists: false },
      { hash: null, realpath: null },
    ],
    [
      "failed read alone is lossy",
      { readFile: { ok: false } },
      { hash: null, realpath: null },
    ],
    [
      "readable file",
      {
        fileExists: true,
        readFile: { ok: true, hash },
        realpath: { ok: true, path: "/physical/input.ts" },
      },
      { hash, realpath: "/physical/input.ts" },
    ],
    [
      "directory",
      { stat: "directory", realpath: { ok: true, path: "/physical/types" } },
      { hash: directoryHash, realpath: "/physical/types" },
    ],
    [
      "readable without identity",
      { readFile: { ok: true, hash }, realpath: { ok: false } },
      { failure: "realpath-unavailable" },
    ],
    [
      "directory without identity",
      { directoryExists: true },
      { failure: "realpath-unavailable" },
    ],
    [
      "file without content",
      { fileExists: true, readFile: { ok: false } },
      { failure: "content-unavailable" },
    ],
    [
      "empty listing alone",
      { accessibleEntries: { directories: [], files: [] } },
      { failure: "unsupported-input-kind" },
    ],
    [
      "identity alone",
      { realpath: { ok: true, path: "/physical/input.ts" } },
      { failure: "unsupported-input-kind" },
    ],
  ];
  for (const [name, observation, expected] of projections) {
    const normalized = normalize(observation);
    assert.equal(graphInputObservationCompatible(normalized), true, name);
    assert.deepEqual(
      legacyProjectionOfGraphInputObservation(normalized),
      expected,
      name,
    );
  }

  const root = fs.realpathSync.native(
    TestProject.createProject({
      "src/main.ts": "export {};\n",
      "node_modules/dep0/index.ts": "export const candidate = 1;\n",
      "tsconfig.json": "{}\n",
    }),
  );
  const present = path.join(root, "node_modules", "dep0", "index.ts");
  const absent = path.join(root, "node_modules", "dep1", "index.ts");
  const main = path.join(root, "src", "main.ts");
  const presentHash = createHash("sha256")
    .update(fs.readFileSync(present))
    .digest("hex");
  const mainHash = createHash("sha256")
    .update(fs.readFileSync(main))
    .digest("hex");
  for (const mode of [
    "rich-only",
    "contradictory-hash",
    "unprojectable",
  ] as const) {
    let candidateReads = 0;
    let candidateProbes = 0;
    const observation: Observation =
      mode === "contradictory-hash"
        ? {
            fileExists: true,
            stat: "file",
            readFile: { ok: true, hash: presentHash },
            realpath: { ok: true, path: fs.realpathSync.native(present) },
          }
        : { fileExists: true };
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success",
      typescript: { "src/main.ts": "export {};\n" },
      graph: {
        edges: { "src/main.ts": [] },
        globals: [],
        configs: [],
        candidates: {
          "src/main.ts": [
            "node_modules/dep0/index.ts",
            "node_modules/dep1/index.ts",
          ],
        },
        inputObservations: {
          "node_modules/dep0/index.ts": observation,
          "node_modules/dep1/index.ts": { fileExists: false },
        },
        inputHashes: {
          "src/main.ts": mainHash,
          ...(mode === "rich-only"
            ? {}
            : {
                "node_modules/dep0/index.ts":
                  mode === "contradictory-hash" ? hash : presentHash,
              }),
        },
        inputRealpaths: {
          "src/main.ts": fs.realpathSync.native(main),
          ...(mode === "rich-only"
            ? {}
            : {
                "node_modules/dep0/index.ts": fs.realpathSync.native(present),
              }),
        },
        ...(mode === "rich-only"
          ? {
              inputProofFailures: {
                "node_modules/dep0/index.ts": "content-unavailable",
              },
            }
          : {}),
      },
    };
    const filesystem = {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      readFile: (location: string) => {
        if (location === present || location === absent) candidateReads++;
        return DEFAULT_FILESYSTEM_OPERATIONS.readFile(location);
      },
      stat: (location: string) => {
        if (location === present || location === absent) candidateProbes++;
        return DEFAULT_FILESYSTEM_OPERATIONS.stat(location);
      },
      watch: () => {
        throw Object.assign(
          new Error("authored candidate watch registration refusal"),
          { code: "ENOSPC" },
        );
      },
    };
    TRANSFORM_RESULT_FILESYSTEM.set(result, filesystem);
    const cached: TtscCachedProjectTransform = {
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
      result,
      inputHashes: {},
      membershipPolicy: readProjectMembershipPolicy(
        path.join(root, "tsconfig.json"),
      ),
    };
    try {
      const state = envelopeDerivation(cached);
      const indexed = envelopeGraphIndexes(state, cached);
      const failures = compilerGraphInputProofFailures(cached);
      if (mode === "rich-only") {
        assert.equal(
          indexed.inputProofFailures.has(present),
          false,
          "matching unrepresentable projection does not invalidate rich candidate evidence",
        );
        assert.deepEqual(failures.entries, []);
        const external = captureExternalInputSnapshot(
          cached,
          [present, absent],
          undefined,
        );
        assert.equal(external.complete, true);
        assert.deepEqual(external.failures.entries, []);
        assert.deepEqual(external.observations, {
          [present]: { fileExists: true },
          [absent]: { fileExists: false },
        });
        cached.externalInputObservations = external.observations;
        const carrier = evidencedWatchInput(
          cached,
          state,
          absent,
          (input) => input,
        );
        assert.equal(carrier.file, absent);
        assert.equal(carrier.evidence!.missing, true);
        assert.equal(carrier.evidence!.unavailable, "not-file");
        assert.deepEqual(carrier.evidence!.state, {
          codec: "predicates",
          observation: { fileExists: false },
        });
        assert.equal(
          candidateReads,
          0,
          "existence-only replay and external capture do not read candidate content",
        );
        const tracker = await createHostInputMutationTracker(
          [present, absent],
          filesystem,
          new Set([present, absent]),
          "rename",
          root,
        );
        try {
          assert.equal(
            tracker.failed,
            true,
            "ENOSPC cannot confer notification authority",
          );
          candidateProbes = 0;
          for (let delivery = 0; delivery < 3; delivery++) {
            assert.deepEqual(
              compilerGraphInputProofFailures(cached).entries,
              [],
            );
          }
          assert.ok(
            candidateProbes > 0,
            "unavailable notifications do not replace direct candidate replay",
          );
          assert.equal(candidateReads, 0);
          fs.mkdirSync(path.dirname(absent), { recursive: true });
          fs.writeFileSync(absent, "export {};\n");
          assert.deepEqual(compilerGraphInputProofFailures(cached).entries, [
            { domain: "graph", kind: "file-exists-changed", path: absent },
          ]);
          fs.rmSync(absent);
          assert.deepEqual(compilerGraphInputProofFailures(cached).entries, []);
        } finally {
          tracker.close();
        }
      } else {
        assert.deepEqual(failures.entries, [
          {
            domain: "graph",
            kind: "proof-conflict",
            path: present,
            detail:
              mode === "unprojectable" ? "content-unavailable" : undefined,
          },
        ]);
        assert.equal(failures.omitted, 0);
        assert.equal(
          candidateReads,
          mode === "contradictory-hash" ? 1 : 0,
          "only an actual recorded read predicate reads candidate bytes",
        );
      }
    } finally {
      TRANSFORM_RESULT_FILESYSTEM.delete(result);
    }
  }

  const scratchRoot = fs.realpathSync.native(
    TestProject.createProject({
      "src/main.ts": "export {};\n",
      "tsconfig.json": "{}\n",
    }),
  );
  const scratch = path.join(scratchRoot, ".capture-scratch");
  const wrapper = path.join(scratch, "tsconfig.json");
  const sibling = path.join(
    scratchRoot,
    ".capture-scratch-neighbor",
    "tsconfig.json",
  );
  const original = path.join(scratchRoot, "tsconfig.json");
  const originalBytes = "{}\n";
  const siblingBytes = '{"compilerOptions":{"strict":true}}\n';
  fs.mkdirSync(path.dirname(sibling));
  fs.writeFileSync(sibling, siblingBytes);
  const originalHash = createHash("sha256").update(originalBytes).digest("hex");
  const siblingHash = createHash("sha256").update(siblingBytes).digest("hex");
  const originalRealpath = fs.realpathSync.native(original);
  const siblingRealpath = fs.realpathSync.native(sibling);
  const originalObservation: Observation = {
    readFile: { ok: true, hash: originalHash },
    realpath: { ok: true, path: originalRealpath },
  };
  const siblingObservation: Observation = {
    readFile: { ok: true, hash: siblingHash },
    realpath: { ok: true, path: siblingRealpath },
  };
  for (const scratchMode of ["readable", "malformed", "conflicting"] as const) {
    fs.mkdirSync(scratch);
    const wrapperBytes = '{"extends":"../tsconfig.json"}\n';
    fs.writeFileSync(wrapper, wrapperBytes);
    const wrapperHash = createHash("sha256").update(wrapperBytes).digest("hex");
    const wrapperRealpath = fs.realpathSync.native(wrapper);
    const wrapperObservation: Observation = {
      readFile: { ok: true, hash: wrapperHash },
      realpath: { ok: true, path: wrapperRealpath },
    };
    const wrapperAlias = scratch + path.sep + "." + path.sep + "tsconfig.json";
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success",
      typescript: {},
      graph: {
        edges: {},
        configs: [original, wrapper, sibling],
        inputObservations: {
          [original]: originalObservation,
          [sibling]: siblingObservation,
          [wrapper]:
            scratchMode === "malformed"
              ? ({ stat: "invalid-kind" } as unknown as Observation)
              : wrapperObservation,
          ...(scratchMode === "conflicting"
            ? {
                [wrapperAlias]: {
                  readFile: { ok: true as const, hash: otherHash },
                },
              }
            : {}),
        },
        inputHashes: {
          [original]: originalHash,
          [wrapper]: wrapperHash,
          [sibling]: siblingHash,
        },
        inputRealpaths: {
          [original]: originalRealpath,
          [wrapper]: wrapperRealpath,
          [sibling]: siblingRealpath,
        },
      },
    };
    const cached: TtscCachedProjectTransform = {
      projectRoot: scratchRoot,
      tsconfig: original,
      result,
      inputHashes: {},
      scratchDirectory: scratch,
    };
    try {
      const indexed = envelopeGraphIndexes(envelopeDerivation(cached), cached);
      assert.equal(
        indexed.inputObservationConflicts.has(wrapper),
        scratchMode !== "readable",
        "the index retains malformed/conflicting facts; scratch ownership governs replay exclusion",
      );
      assert.deepEqual(compilerGraphInputProofFailures(cached).entries, []);
      await removeCaptureScratch(scratch);
      assert.equal(fs.existsSync(wrapper), false);
      assert.deepEqual(
        compilerGraphInputProofFailures(cached).entries,
        [],
        scratchMode +
          ": disposed publisher scratch does not refute persistent graph inputs",
      );

      fs.writeFileSync(original, '{"compilerOptions":{"strict":false}}\n');
      assert.deepEqual(compilerGraphInputProofFailures(cached).entries, [
        { domain: "graph", kind: "read-file-changed", path: original },
      ]);
      fs.writeFileSync(original, originalBytes);
      fs.unlinkSync(original);
      assert.throws(
        () => fs.realpathSync.native(original),
        (error: NodeJS.ErrnoException) => error.code === "ENOENT",
      );
      assert.deepEqual(
        compilerInputRealpathObservation(
          original,
          DEFAULT_FILESYSTEM_OPERATIONS,
        ),
        { ok: true, path: original },
        "compiler realpath failure preserves the cleaned lexical spelling, independently of content absence",
      );
      assert.deepEqual(compilerGraphInputProofFailures(cached).entries, [
        { domain: "graph", kind: "read-file-changed", path: original },
      ]);
      fs.writeFileSync(original, originalBytes);
      fs.writeFileSync(sibling, '{"compilerOptions":{"strict":false}}\n');
      assert.deepEqual(
        compilerGraphInputProofFailures(cached).entries,
        [{ domain: "graph", kind: "read-file-changed", path: sibling }],
        "a same-prefix sibling is outside the owned scratch directory",
      );
      fs.writeFileSync(sibling, siblingBytes);
      assert.deepEqual(compilerGraphInputProofFailures(cached).entries, []);
    } finally {
      fs.writeFileSync(original, originalBytes);
      fs.writeFileSync(sibling, siblingBytes);
      fs.rmSync(scratch, { recursive: true, force: true });
    }
  }
  const persistentConflict: TtscCachedProjectTransform = {
    projectRoot: scratchRoot,
    tsconfig: original,
    inputHashes: {},
    scratchDirectory: scratch,
    result: {
      type: "success",
      typescript: {},
      graph: {
        edges: {},
        configs: [original],
        inputObservations: {
          [original]: originalObservation,
          [scratchRoot + path.sep + "." + path.sep + "tsconfig.json"]: {
            readFile: { ok: true, hash: otherHash },
          },
        },
      },
    },
  };
  assert.deepEqual(
    compilerGraphInputProofFailures(persistentConflict).entries,
    [
      {
        domain: "graph",
        kind: "proof-conflict",
        detail: "conflicting-observation",
        path: original,
      },
    ],
    "scratch exclusion does not suppress a persistent config's conflicting observations",
  );

  const candidateAliasDirectory = path.join(root, "candidate-alias");
  fs.symlinkSync(
    path.dirname(present),
    candidateAliasDirectory,
    process.platform === "win32" ? "junction" : "dir",
  );
  const aliasedCandidate = path.join(candidateAliasDirectory, "index.ts");
  try {
    const candidateRealpath = fs.realpathSync.native(present);
    assert.equal(fs.realpathSync.native(aliasedCandidate), candidateRealpath);
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(aliasedCandidate))
        .digest("hex"),
      presentHash,
    );
    for (const failedAlias of [false, true]) {
      const result: ITtscCompilerTransformation.ISuccess = {
        type: "success",
        typescript: { "src/main.ts": "export {};\n" },
        graph: {
          edges: { "src/main.ts": [] },
          candidates: { "src/main.ts": [present, aliasedCandidate] },
          inputHashes: {
            "src/main.ts": mainHash,
            [present]: presentHash,
            ...(failedAlias ? {} : { [aliasedCandidate]: presentHash }),
          },
          inputRealpaths: {
            "src/main.ts": fs.realpathSync.native(main),
            [present]: candidateRealpath,
            ...(failedAlias ? {} : { [aliasedCandidate]: candidateRealpath }),
          },
          ...(failedAlias
            ? {
                inputProofFailures: {
                  [aliasedCandidate]: "content-unavailable",
                },
              }
            : {}),
        },
      };
      const cached: TtscCachedProjectTransform = {
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
        result,
        inputHashes: {},
      };
      const state = envelopeDerivation(cached);
      const indexed = envelopeGraphIndexes(state, cached);
      assert.equal(
        indexed.inputProofs.has(present),
        true,
        "a failed alias cannot remove the other spelling's independently recorded proof",
      );
      assert.equal(indexed.inputProofs.has(aliasedCandidate), !failedAlias);
      assert.deepEqual(
        compilerGraphInputProofFailures(cached).entries,
        failedAlias
          ? [
              {
                domain: "graph",
                kind: "proof-missing",
                detail: "content-unavailable",
                path: aliasedCandidate,
              },
            ]
          : [],
        "physical equality cannot lend another spelling's proof to a failed alias",
      );
      assert.equal(compilerGraphInputProofFailures(cached).omitted, 0);
      assert.equal(
        evidencedWatchInput(cached, state, present, (input) => input).file,
        present,
      );
      assert.equal(
        evidencedWatchInput(cached, state, aliasedCandidate, (input) => input)
          .file,
        aliasedCandidate,
        "the watch carrier preserves the alias spelling without certifying its missing producer proof",
      );
    }
  } finally {
    fs.unlinkSync(candidateAliasDirectory);
  }
}
