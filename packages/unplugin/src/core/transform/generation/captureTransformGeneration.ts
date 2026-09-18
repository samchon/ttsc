import fs from "node:fs";
import path from "node:path";
import { TtscCompiler } from "ttsc";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { mergeMembershipPolicyOverlay } from "../../tsconfig/mergeMembershipPolicyOverlay";
import { TRANSFORM_RESULT_FILESYSTEM } from "../cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import { refreshFilesystemClockReference } from "../clock/refreshFilesystemClockReference";
import { selectDeclaredProjectInputKeys } from "../envelope/selectDeclaredProjectInputKeys";
import { selectExternalInputPaths } from "../envelope/selectExternalInputPaths";
import { selectNotifiableAbsentInputs } from "../envelope/selectNotifiableAbsentInputs";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { toProjectKey } from "../project/toProjectKey";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { createHostInputMutationTracker } from "../tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../tracker/createProjectMutationTracker";
import { settleMutationTrackers } from "../tracker/settleMutationTrackers";
import { createTransformScratchDirectory } from "../tsconfig/createTransformScratchDirectory";
import { createTransformTsconfig } from "../tsconfig/createTransformTsconfig";
import { readTransformTsconfigState } from "../tsconfig/readTransformTsconfigState";
import { transformScratchEnvironment } from "../tsconfig/transformScratchEnvironment";
import { withTransformScratchEnvironment } from "../tsconfig/withTransformScratchEnvironment";
import { hashText } from "../utils/hashText";
import { captureExternalInputSnapshot } from "../validation/captureExternalInputSnapshot";
import { captureUniversalHostInputValidation } from "../validation/captureUniversalHostInputValidation";
import { compilerGraphInputProofFailures } from "../validation/compilerGraphInputProofFailures";
import { restrictNotificationCoverageToProvenInputs } from "../validation/restrictNotificationCoverageToProvenInputs";
import { sameHashes } from "../validation/sameHashes";
import { sameProjectDirectories } from "../validation/sameProjectDirectories";
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";
import { TRANSFORM_FAILED_GENERATION_VALIDATIONS } from "./TRANSFORM_FAILED_GENERATION_VALIDATIONS";
import { TRANSFORM_GENERATION_FAILURES } from "./TRANSFORM_GENERATION_FAILURES";
import { captureFailedGenerationInputStates } from "./captureFailedGenerationInputStates";
import { captureTransformSourceHashes } from "./captureTransformSourceHashes";
import { createGenerationProofFailures } from "./createGenerationProofFailures";
import { mergeGenerationProofFailures } from "./mergeGenerationProofFailures";
import { projectWalkFailureFingerprint } from "./projectWalkFailureFingerprint";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";
import { recordProjectSnapshotFailures } from "./recordProjectSnapshotFailures";
import { selectPersistentHostInputs } from "./selectPersistentHostInputs";
import { trackerChangedDeclaredProjectInput } from "./trackerChangedDeclaredProjectInput";

const TTSC_SEMANTIC_CONFIG_PATH = "TTSC_SEMANTIC_CONFIG_PATH";

/** Capture one whole-project transform attempt and all of its reuse proofs. */
export async function captureTransformGeneration(props: {
  aliasPaths: Record<string, string[]>;
  compilerOptions: Record<string, unknown>;
  currentFile: string;
  currentSource: string;
  deliveryEpoch?: number;
  filesystem: TtscTransformFilesystemOperations;
  plugins?: ResolvedTtscUnpluginOptions["plugins"];
  retainProjectMembership: boolean;
  trackProjectMembership: boolean;
  tsconfig: string;
}): Promise<TtscCachedProjectTransform> {
  const projectRoot = path.dirname(props.tsconfig);
  const scratchDirectory = createTransformScratchDirectory(
    projectRoot,
    props.filesystem,
  );
  let clockReferenceDirectory: string | undefined;
  let retainClockReferenceDirectory = false;
  let tracker: TtscProjectMutationTracker | undefined;
  let retainTracker = false;
  let hostInputTracker: TtscProjectMutationTracker | undefined;
  let candidateTracker: TtscProjectMutationTracker | undefined;
  let retainHostInputTracker = false;
  let retainCandidateTracker = false;
  let captured: TtscCachedProjectTransform | undefined;
  try {
    if (props.retainProjectMembership) {
      try {
        clockReferenceDirectory = createTransformScratchDirectory(
          projectRoot,
          props.filesystem,
        );
      } catch {
        // A retained probe is an optimization. The live compiler scratch can
        // still authorize capture, and later validations will compare bytes.
      }
    }
    const materializesConfig =
      Object.keys(props.compilerOptions).length !== 0 ||
      Object.keys(props.aliasPaths).length !== 0;
    const tsconfigState = readTransformTsconfigState(
      props.tsconfig,
      materializesConfig,
    );
    const configured = createTransformTsconfig(
      props,
      scratchDirectory,
      tsconfigState,
    );
    const temporaryTsconfig =
      configured.path === props.tsconfig ? undefined : configured.path;
    const compilerEnvironment = transformScratchEnvironment(scratchDirectory);
    if (temporaryTsconfig === undefined) {
      delete compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH];
    } else {
      compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH] = props.tsconfig;
    }
    const identities = createHostPathIdentityContext(props.filesystem);
    // Read from the project's own tsconfig rather than the generated one: a
    // relative `outDir` is anchored at the config that declares it, and the
    // generated config lives in a system temp directory. The caller's
    // compiler-options overlay still wins, since it wins for the compile too.
    const membershipPolicy = mergeMembershipPolicyOverlay(
      tsconfigState.membershipPolicy,
      props.compilerOptions,
      projectRoot,
    );
    const before = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
      undefined,
      { policy: membershipPolicy },
    );
    tracker = props.trackProjectMembership
      ? await createProjectMutationTracker(
          before.projectDirectories,
          new Set(
            Object.keys(before.hashes)
              .filter((key) => !before.notificationUnsafeInputs.has(key))
              .map((key) => path.resolve(projectRoot, key)),
          ),
          props.filesystem,
          membershipPolicy,
        )
      : undefined;
    const result = withTransformScratchEnvironment(scratchDirectory, () =>
      new TtscCompiler({
        cwd: projectRoot,
        // The generated tsconfig (if any) lives outside the project directory,
        // so declare the real project as the plugin config anchor: utility
        // plugin config discovery (banner.config.*, strip.config.*,
        // lint.config.*) and relative configFile resolution walk the project,
        // never the temp tree. In the passthrough case this equals the
        // tsconfig's own directory, the default anchor.
        pluginConfigDir: projectRoot,
        plugins: props.plugins,
        projectRoot,
        tsconfig: configured.path,
        env: compilerEnvironment,
      }).transform(),
    );
    TRANSFORM_RESULT_FILESYSTEM.set(result, props.filesystem);
    const configStable =
      tsconfigState.signature === undefined ||
      tsconfigState.signature ===
        readTransformTsconfigState(props.tsconfig, true).signature;
    // Mint the generation's clock reference after the compile and before any
    // signature-recording read below, so every input written before the
    // compile sits in a provably finished tick when its signature is captured.
    refreshFilesystemClockReference(
      clockReferenceDirectory ?? scratchDirectory,
      props.filesystem,
    );
    const persistentHostInputs = selectPersistentHostInputs({
      filesystem: props.filesystem,
      projectRoot,
      result,
      scratchDirectory,
      temporaryTsconfig,
    });
    const externalInputPaths = selectExternalInputPaths({
      filesystem: props.filesystem,
      membershipPolicy,
      projectRoot,
      result,
      scratchDirectory,
      temporaryTsconfig,
    });
    const persistentValidationInputs = [
      ...new Set([...persistentHostInputs, ...externalInputPaths]),
    ];
    // The generation's absent resolution candidates, which get a watcher of
    // their own below; watching one is what lets a delivery stop probing it
    // (samchon/ttsc#1261). The validation manifest stays built from the
    // universal inputs alone, so nothing else about a candidate changes.
    //
    // Derived only where a retained tracker could carry it: a build-scoped
    // adapter keeps only the compile-time project observer, so probing every
    // candidate here would be work whose answer nothing can later read.
    const notifiableAbsence = props.retainProjectMembership
      ? selectNotifiableAbsentInputs({
          filesystem: props.filesystem,
          projectRoot,
          result,
          scratchDirectory,
          temporaryTsconfig,
        })
      : { candidates: [], watched: [] };
    hostInputTracker = props.retainProjectMembership
      ? await createHostInputMutationTracker(
          persistentValidationInputs,
          props.filesystem,
          // A universal input never reaches the per-input loop that consults a
          // coverage claim: an absent one is proven by its directory listing
          // instead, which re-resolves the spelling every delivery.
          new Set(
            persistentValidationInputs.map((input) => path.resolve(input)),
          ),
          "all",
          projectRoot,
        )
      : undefined;
    // The candidates and the directories carrying them get their own tracker,
    // listening for renames alone. Every event that can make one of these
    // paths appear is a rename — the file itself, or a component of the path
    // being created, replaced, or retargeted — so nothing is given up, while a
    // backend that reports a write below a directory as a change to that
    // directory's entry (Windows does) would otherwise replace the generation
    // every time a bundler wrote inside `node_modules`.
    candidateTracker =
      notifiableAbsence.watched.length !== 0
        ? await createHostInputMutationTracker(
            notifiableAbsence.watched,
            props.filesystem,
            new Set(notifiableAbsence.candidates),
            "rename",
            projectRoot,
          )
        : undefined;
    const inputSnapshot = collectProjectInputSnapshot(
      projectRoot,
      identities,
      props.filesystem,
      undefined,
      { policy: membershipPolicy },
    );
    // Whether the recorded snapshot describes one coherent state of the
    // project. A membership event during the compile taints it exactly like an
    // unstable walk pair; whether notifications can be *opened* is a separate
    // fact, tracked below, because a generation with no watcher is still
    // provable from its own recorded state.
    const declaredInputs = selectDeclaredProjectInputKeys({
      identities,
      projectInputHashes: inputSnapshot.hashes,
      projectRoot,
      result,
      scratchDirectory,
    });
    // The before/after snapshots prove bytes and metadata. Drain the watcher
    // opened before compilation as the independent A-B-A witness: a producer
    // can restore both bytes and timestamps before the second walk, but it
    // cannot withdraw the already queued content event.
    //
    // Only that watcher can decide the verdict. The host-input and candidate
    // trackers opened after the compile returned, so they never saw what it
    // read: a change in their window before the reads below is already visible
    // to those reads, which fail the attempt on a real mismatch, and a change
    // after them stays queued as a path witness that sends the input back to
    // being proven on the next delivery. Letting their events reject the
    // attempt added no correctness and turned unrelated writes, a test
    // runner's cache under `node_modules` among them, into a terminal
    // generation failure (samchon/ttsc#1383). They are still settled here so
    // a failed watcher is known before the generation is published.
    await settleMutationTrackers([tracker, hostInputTracker, candidateTracker]);
    const walkStable =
      configStable &&
      walkSnapshotComplete(before, declaredInputs) &&
      walkSnapshotComplete(inputSnapshot, declaredInputs) &&
      sameHashes(before.hashes, inputSnapshot.hashes, declaredInputs) &&
      sameHashes(
        before.fileSignatures,
        inputSnapshot.fileSignatures,
        declaredInputs,
      ) &&
      sameProjectDirectories(
        before.projectDirectories,
        inputSnapshot.projectDirectories,
      ) &&
      !trackerChangedDeclaredProjectInput(
        tracker,
        declaredInputs,
        projectRoot,
      ) &&
      tracker?.membershipChanged !== true;
    const notificationsAvailable =
      tracker?.failed !== true &&
      hostInputTracker?.failed !== true &&
      candidateTracker?.failed !== true;
    // Overlay the in-memory source only after proving the two on-disk snapshots
    // stable; an unsaved editor buffer must not look like a compile-time race.
    const currentFileKey = toProjectKey(
      projectRoot,
      props.currentFile,
      identities,
    );
    const currentSourceHash = hashText(props.currentSource);
    const projectInputHashes = { ...inputSnapshot.hashes };
    if (
      Object.prototype.hasOwnProperty.call(inputSnapshot.hashes, currentFileKey)
    ) {
      inputSnapshot.hashes[currentFileKey] = currentSourceHash;
      // That overlay makes this one key the only recorded hash a disk signature
      // cannot stand for: the bytes it names came from the bundler, not the file.
      delete inputSnapshot.provenSignatures[currentFileKey];
    }
    const cached: TtscCachedProjectTransform = {
      // The pass this compile was started for. Its snapshot describes the
      // project as of this compile, so it is settled for this pass and any
      // later pass must re-prove it.
      ...(props.deliveryEpoch === undefined
        ? {}
        : { deliveryEpoch: props.deliveryEpoch }),
      // Capture the out-of-walk input hashes while the generation is fresh so
      // cache validation can re-check them; computed before dispose so the
      // scratch-tree exclusion is the only reason its disposed artifacts never
      // key the persistent generation.
      externalInputHashes: {},
      externalInputRealpaths: {},
      externalInputPaths,
      configStateComplete: configStable,
      inputHashes: inputSnapshot.hashes,
      inputSignatures: inputSnapshot.provenSignatures,
      membershipPolicy,
      projectDirectories: inputSnapshot.projectDirectories,
      tsconfig: props.tsconfig,
      projectSnapshotComplete: false,
      projectRoot,
      result,
      scratchDirectory,
      servedFiles: new Set(),
      // Remember the generated temp-dir tsconfig (disposed below) so watch
      // derivation can drop it from the envelope's config chain; a registered
      // but deleted file would invalidate every persistent-cache snapshot.
      ...(temporaryTsconfig === undefined ? {} : { temporaryTsconfig }),
    };
    cached.sourceHashes = captureTransformSourceHashes(
      cached,
      props.currentFile,
      currentSourceHash,
    );
    const externalInputSnapshot = captureExternalInputSnapshot(
      cached,
      externalInputPaths,
    );
    cached.externalInputHashes = externalInputSnapshot.hashes;
    cached.externalInputObservations = externalInputSnapshot.observations;
    cached.externalInputRealpaths = externalInputSnapshot.realpaths;
    cached.externalInputSignatures = externalInputSnapshot.signatures;
    // Evaluate every half, rather than short-circuiting, so a generation that
    // cannot be reused can say which evidence it lacked. The extra work runs
    // only on the failing path, where the alternative is recompiling the whole
    // project for every remaining module.
    const failures = createGenerationProofFailures();
    if (!configStable) {
      recordGenerationProofFailure(failures, {
        domain: "project",
        kind: "config-state-changed",
        path: props.tsconfig,
      });
    }
    if (!walkStable) {
      recordProjectSnapshotFailures(failures, {
        before,
        declared: declaredInputs,
        identities,
        projectRoot,
        snapshot: inputSnapshot,
        tracker,
      });
    }
    const graphFailures = compilerGraphInputProofFailures(cached);
    mergeGenerationProofFailures(failures, graphFailures);
    mergeGenerationProofFailures(failures, externalInputSnapshot.failures);
    const universalInputCapture = captureUniversalHostInputValidation(
      cached,
      props.currentFile,
    );
    restrictNotificationCoverageToProvenInputs(
      hostInputTracker,
      cached,
      universalInputCapture.validation,
    );
    mergeGenerationProofFailures(failures, universalInputCapture.failures);
    const graphProofs =
      graphFailures.entries.length === 0 && graphFailures.omitted === 0;
    const universalInputs = universalInputCapture.validation !== undefined;
    const stableProjectSnapshot =
      walkStable &&
      graphProofs &&
      externalInputSnapshot.complete &&
      universalInputs;
    if (!stableProjectSnapshot) {
      TRANSFORM_GENERATION_FAILURES.set(result, failures);
      TRANSFORM_FAILED_GENERATION_VALIDATIONS.set(result, {
        cached,
        declaredInputs,
        inputStates: captureFailedGenerationInputStates(cached, failures),
        projectInputHashes,
        projectWalkComplete: walkSnapshotComplete(
          inputSnapshot,
          declaredInputs,
        ),
        projectWalkFailures: projectWalkFailureFingerprint(
          inputSnapshot,
          declaredInputs,
          projectRoot,
          identities,
        ),
      });
    }
    cached.projectSnapshotComplete = stableProjectSnapshot;
    // Attach notifications only while they can actually prove membership. A
    // generation that could not open its watchers keeps its recorded snapshot
    // and validates through it, rather than losing the cache entirely.
    const notifying =
      props.retainProjectMembership &&
      stableProjectSnapshot &&
      notificationsAvailable;
    if (notifying && tracker !== undefined) {
      cached.projectMutationTracker = tracker;
    }
    if (notifying && hostInputTracker !== undefined) {
      cached.hostInputMutationTracker = hostInputTracker;
    }
    if (notifying && candidateTracker !== undefined) {
      cached.candidateMutationTracker = candidateTracker;
    }
    // Every tracker the generation published is retained, and every tracker it
    // did not is closed below. Naming only two of the three would close a
    // published candidate tracker the moment either of the others was absent,
    // and that is the one tracker whose silence is read as evidence.
    retainTracker = notifying && tracker !== undefined;
    retainHostInputTracker = notifying && hostInputTracker !== undefined;
    retainCandidateTracker = notifying && candidateTracker !== undefined;
    if (clockReferenceDirectory !== undefined) {
      retainClockReferenceDirectory = true;
    }
    captured = cached;
  } finally {
    let cleanupFailed = false;
    let cleanupFailure: unknown;
    try {
      try {
        if (!retainTracker && tracker !== undefined) {
          tracker.close();
        }
      } finally {
        try {
          if (!retainHostInputTracker && hostInputTracker !== undefined) {
            hostInputTracker.close();
          }
        } finally {
          try {
            if (!retainCandidateTracker && candidateTracker !== undefined) {
              candidateTracker.close();
            }
          } finally {
            try {
              fs.rmSync(scratchDirectory, { force: true, recursive: true });
            } finally {
              if (
                !retainClockReferenceDirectory &&
                clockReferenceDirectory !== undefined
              ) {
                disposeFilesystemClockReference(clockReferenceDirectory);
              }
            }
          }
        }
      }
    } catch (error) {
      cleanupFailed = true;
      cleanupFailure = error;
    }
    if (cleanupFailed) {
      // The generation never leaves this function when local cleanup fails.
      // Close everything that was waiting to transfer, without letting a
      // secondary teardown error replace the first failure.
      for (const retained of [
        retainTracker ? tracker : undefined,
        retainHostInputTracker ? hostInputTracker : undefined,
        retainCandidateTracker ? candidateTracker : undefined,
      ]) {
        try {
          retained?.close();
        } catch {
          // Continue releasing the other generation-owned resources.
        }
      }
      if (
        retainClockReferenceDirectory &&
        clockReferenceDirectory !== undefined
      ) {
        disposeFilesystemClockReference(clockReferenceDirectory);
      }
      throw cleanupFailure;
    }
  }
  if (captured === undefined) {
    throw new Error("ttsc: transform generation capture produced no result");
  }
  if (clockReferenceDirectory !== undefined) {
    TRANSFORM_CLOCK_REFERENCE_DIRECTORIES.set(
      captured,
      clockReferenceDirectory,
    );
  }
  return captured;
}
