import fs from "node:fs";
import path from "node:path";
import { TtscCompiler } from "ttsc";

import type { ResolvedTtscUnpluginOptions } from "../../options/ResolvedTtscUnpluginOptions";
import { mergeMembershipPolicyOverlay } from "../../tsconfig/mergeMembershipPolicyOverlay";
import { readTsconfigSourceSnapshot } from "../../tsconfig/readTsconfigSourceSnapshot";
import { TRANSFORM_RESULT_FILESYSTEM } from "../cache/TRANSFORM_RESULT_FILESYSTEM";
import type { TtscCachedProjectTransform } from "../cache/TtscCachedProjectTransform";
import { TRANSFORM_CLOCK_REFERENCE_DIRECTORIES } from "../clock/TRANSFORM_CLOCK_REFERENCE_DIRECTORIES";
import { disposeFilesystemClockReference } from "../clock/disposeFilesystemClockReference";
import { refreshFilesystemClockReference } from "../clock/refreshFilesystemClockReference";
import { reportDivergentDelivery } from "../diagnostics/reportDivergentDelivery";
import { selectDeclaredProjectInputKeys } from "../envelope/selectDeclaredProjectInputKeys";
import { selectExternalInputPaths } from "../envelope/selectExternalInputPaths";
import { selectNotifiableAbsentInputs } from "../envelope/selectNotifiableAbsentInputs";
import type { TtscTransformFilesystemOperations } from "../filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../filesystem/createHostPathIdentityContext";
import { collectProjectInputSnapshot } from "../project/collectProjectInputSnapshot";
import { toProjectKey } from "../project/toProjectKey";
import { TRANSFORM_ADOPTED_RESULTS } from "../session/TRANSFORM_ADOPTED_RESULTS";
import type { TtscSharedCompileClaim } from "../session/TtscSharedCompileClaim";
import { adoptedExternalInputMismatch } from "../session/adoptedExternalInputMismatch";
import { claimSharedCompile } from "../session/claimSharedCompile";
import { sharedCompileIdentity } from "../session/sharedCompileIdentity";
import { sharedCompileState } from "../session/sharedCompileState";
import type { TtscProjectMutationTracker } from "../tracker/TtscProjectMutationTracker";
import { createHostInputMutationTracker } from "../tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../tracker/createProjectMutationTracker";
import { settleMutationTrackers } from "../tracker/settleMutationTrackers";
import { trackedInputScopes } from "../tracker/trackedInputScopes";
import { compilerProjectSpelling } from "../tsconfig/compilerProjectSpelling";
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
import { walkSnapshotComplete } from "../validation/walkSnapshotComplete";
import { TRANSFORM_FAILED_GENERATION_VALIDATIONS } from "./TRANSFORM_FAILED_GENERATION_VALIDATIONS";
import { TRANSFORM_GENERATION_FAILURES } from "./TRANSFORM_GENERATION_FAILURES";
import { captureFailedGenerationInputStates } from "./captureFailedGenerationInputStates";
import { captureTransformSourceHashes } from "./captureTransformSourceHashes";
import { createGenerationProofFailures } from "./createGenerationProofFailures";
import { mergeGenerationProofFailures } from "./mergeGenerationProofFailures";
import { projectWalkFailureFingerprint } from "./projectWalkFailureFingerprint";
import { projectWalkStable } from "./projectWalkStable";
import { recordGenerationProofFailure } from "./recordGenerationProofFailure";
import { recordProjectSnapshotFailures } from "./recordProjectSnapshotFailures";
import { selectPersistentHostInputs } from "./selectPersistentHostInputs";

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
  /**
   * Whether the generation may keep watchers whose silence stands in for
   * re-reading its inputs. False once the host or the environment declares
   * polling (samchon/ttsc#1395); the generation then validates every delivery
   * against its recorded state.
   */
  retainNotifications: boolean;
  /**
   * The pooled host session's shared compile store, when the cache shares its
   * compiles (samchon/ttsc#1390). The attempt then takes another worker's
   * compile of the same project state, or compiles under the session's lock and
   * publishes its compile once proven.
   */
  session?: string;
  /**
   * Whether an existing publication may be adopted. False on the retry of an
   * attempt whose adopted compile failed its proof here.
   */
  adopt?: boolean;
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
  let sharedClaim:
    | Extract<TtscSharedCompileClaim, { kind: "compile" }>
    | undefined;
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
    // The project as the compiler will see it: it resolves the config and the
    // root to their physical paths, and everything written for it, the
    // wrapper's paths and the plugin config anchor, is spelled that way
    // (samchon/ttsc#1456). A config the compiler cannot locate is left as
    // named; the compile then reports it.
    const compilerProject = compilerProjectSpelling(
      props.tsconfig,
      projectRoot,
    );
    const tsconfigState = readTransformTsconfigState(
      props.tsconfig,
      materializesConfig,
      compilerProject.configDir,
    );
    const configured = createTransformTsconfig(
      props,
      scratchDirectory,
      tsconfigState,
      compilerProject,
    );
    const temporaryTsconfig =
      configured.path === props.tsconfig ? undefined : configured.path;
    const compilerEnvironment = transformScratchEnvironment(scratchDirectory);
    if (temporaryTsconfig === undefined) {
      delete compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH];
    } else {
      // The program's config path is the project's own config, spelled as the
      // compiler would have spelled it had it been given that config directly.
      compilerEnvironment[TTSC_SEMANTIC_CONFIG_PATH] = compilerProject.tsconfig;
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
    // A pooled worker takes another worker's compile of exactly this project
    // state instead of compiling the whole project again (samchon/ttsc#1390).
    // Only a complete snapshot names a state. The adopted envelope is then
    // proven below like one compiled here, against this worker's own
    // filesystem and inside the window its tracker already watches.
    const claim =
      props.session !== undefined && before.complete
        ? await claimSharedCompile(
            props.session,
            sharedCompileIdentity(props),
            sharedCompileState({
              directories: before.projectDirectories,
              hashes: before.hashes,
              // The chain's own text when no wrapper derived a signature
              // from it, since the walk hashes no config file.
              tsconfigSignature:
                tsconfigState.signature ??
                hashText(
                  JSON.stringify(readTsconfigSourceSnapshot(props.tsconfig)),
                ),
            }),
            { adopt: props.adopt !== false },
          )
        : undefined;
    if (claim?.kind === "compile") {
      sharedClaim = claim;
    }
    const adopted = claim?.kind === "adopt" ? claim.publication : undefined;
    // The envelope names paths in the scratch directory of whoever compiled
    // it, and those are what the input selectors below must exclude.
    const envelopeScratchDirectory =
      adopted?.scratchDirectory ?? scratchDirectory;
    const envelopeTemporaryTsconfig =
      adopted === undefined ? temporaryTsconfig : adopted.temporaryTsconfig;
    // The compile runs on a worker thread that adopts the environment as it is
    // at the call, so the scratch scope covers the whole compile yet ends as
    // soon as the call returns, and the host keeps serving other work while it
    // runs (samchon/ttsc#1391).
    const result =
      adopted?.result ??
      (await withTransformScratchEnvironment(scratchDirectory, () =>
        new TtscCompiler({
          cwd: projectRoot,
          // The generated tsconfig (if any) lives outside the project directory,
          // so declare the real project as the plugin config anchor: utility
          // plugin config discovery (banner.config.*, strip.config.*,
          // lint.config.*) and relative configFile resolution walk the project,
          // never the temp tree. In the passthrough case this equals the
          // tsconfig's own directory, the default anchor, spelled as the
          // compiler spells it.
          pluginConfigDir: compilerProject.configDir,
          plugins: props.plugins,
          projectRoot,
          tsconfig: configured.path,
          env: compilerEnvironment,
        }).transformAsync(),
      ));
    if (adopted !== undefined) {
      TRANSFORM_ADOPTED_RESULTS.add(result);
    }
    TRANSFORM_RESULT_FILESYSTEM.set(result, props.filesystem);
    const configStable =
      tsconfigState.signature === undefined ||
      tsconfigState.signature ===
        readTransformTsconfigState(
          props.tsconfig,
          true,
          compilerProject.configDir,
        ).signature;
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
      scratchDirectory: envelopeScratchDirectory,
      temporaryTsconfig: envelopeTemporaryTsconfig,
    });
    const externalInputPaths = selectExternalInputPaths({
      filesystem: props.filesystem,
      membershipPolicy,
      projectRoot,
      result,
      scratchDirectory: envelopeScratchDirectory,
      temporaryTsconfig: envelopeTemporaryTsconfig,
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
    const notifiableAbsence =
      props.retainProjectMembership && props.retainNotifications
        ? selectNotifiableAbsentInputs({
            filesystem: props.filesystem,
            projectRoot,
            result,
            scratchDirectory: envelopeScratchDirectory,
            temporaryTsconfig: envelopeTemporaryTsconfig,
          })
        : { candidates: [], watched: [] };
    hostInputTracker =
      props.retainProjectMembership && props.retainNotifications
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
            trackedInputScopes({
              filesystem: props.filesystem,
              inputs: persistentValidationInputs,
              projectRoot,
              result,
            }),
          )
        : undefined;
    // The candidates and the directories carrying them get their own tracker,
    // listening for renames alone. Every event that can make one of these
    // paths appear is a rename — the file itself, or a component of the path
    // being created, replaced, or retargeted — so nothing is given up, while a
    // backend that reports a write below a directory as a change to that
    // directory's entry (Windows does) would otherwise replace the generation
    // every time a bundler wrote inside `node_modules`.
    const absentCandidates = new Set(notifiableAbsence.candidates);
    candidateTracker =
      notifiableAbsence.watched.length !== 0
        ? await createHostInputMutationTracker(
            notifiableAbsence.watched,
            props.filesystem,
            absentCandidates,
            "rename",
            projectRoot,
            // The directories carrying a candidate matter only for being
            // replaced or retargeted. A candidate itself is left to the
            // tracker: absent, it is tracked as its first missing component,
            // and present as a directory, which only a replacement can turn
            // into the file the compiler asked for, it keeps every event
            // below it. A recursive delete reports the children before the
            // directory, and on Windows the directory's own event can still
            // be in flight when a delivery reads the tracker.
            new Map(
              notifiableAbsence.watched
                .filter((input) => !absentCandidates.has(input))
                .map((input) => [path.resolve(input), "presence" as const]),
            ),
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
      scratchDirectory: envelopeScratchDirectory,
    });
    // Only the tracker opened before the compile decides the verdict (see
    // `projectWalkStable`). The host-input and candidate trackers are still
    // settled here so a failed watcher is known before the generation is
    // published.
    await settleMutationTrackers([tracker, hostInputTracker, candidateTracker]);
    const walkStable = projectWalkStable({
      before,
      configStable,
      declared: declaredInputs,
      projectRoot,
      snapshot: inputSnapshot,
      tracker,
    });
    const notificationsAvailable =
      tracker?.failed !== true &&
      hostInputTracker?.failed !== true &&
      candidateTracker?.failed !== true;
    // The compile read this file from disk, so the disk's bytes are its state in
    // this generation. A delivered text that differs, because a plugin ordered
    // before ttsc rewrote the module or the file changed after the host read
    // it, must not replace them: every sibling delivery compares the disk and
    // would recompile the project (samchon/ttsc#1394). It is reported once
    // instead, and the file's own compile is served.
    const currentFileKey = toProjectKey(
      projectRoot,
      props.currentFile,
      identities,
    );
    const deliveredHash = hashText(props.currentSource);
    const diskHash = Object.prototype.hasOwnProperty.call(
      inputSnapshot.hashes,
      currentFileKey,
    )
      ? inputSnapshot.hashes[currentFileKey]
      : undefined;
    const projectInputHashes = { ...inputSnapshot.hashes };
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
      projectHeldStill: walkStable,
      inputHashes: inputSnapshot.hashes,
      inputSignatures: inputSnapshot.provenSignatures,
      membershipPolicy,
      projectDirectories: inputSnapshot.projectDirectories,
      tsconfig: props.tsconfig,
      projectSnapshotComplete: false,
      projectRoot,
      result,
      scratchDirectory: envelopeScratchDirectory,
      servedFiles: new Set(),
      // Remember the generated temp-dir tsconfig (disposed below) so watch
      // derivation can drop it from the envelope's config chain; a registered
      // but deleted file would invalidate every persistent-cache snapshot.
      ...(envelopeTemporaryTsconfig === undefined
        ? {}
        : { temporaryTsconfig: envelopeTemporaryTsconfig }),
    };
    cached.sourceHashes = captureTransformSourceHashes(
      cached,
      props.currentFile,
      diskHash ?? deliveredHash,
    );
    if (diskHash !== undefined && diskHash !== deliveredHash) {
      reportDivergentDelivery(cached, props.currentFile);
    }
    const externalInputSnapshot = captureExternalInputSnapshot(
      cached,
      externalInputPaths,
    );
    cached.externalInputHashes = externalInputSnapshot.hashes;
    cached.externalInputObservations = externalInputSnapshot.observations;
    cached.externalInputRealpaths = externalInputSnapshot.realpaths;
    cached.externalInputSignatures = externalInputSnapshot.signatures;
    // Publish only a compile whose snapshot held for the whole compile, so the
    // state it is published under is the state it read. A compile that ended
    // in diagnostics is such a compile: the diagnostics are a function of the
    // state, and a pool whose host discards a worker after each failed run,
    // as Turbopack does, would otherwise compile the same broken state once
    // per fresh worker and per module, which on a slow machine outlasted the
    // host's own patience (samchon/ttsc#1458). An exception stays local: it
    // may come from a transient plugin crash, which each worker must be free
    // to attempt again, as without sharing. The external inputs a plugin
    // reports carry no compile-time proof, only the state recorded right after
    // the compile, so that state travels with the publication for every
    // adopter to match (samchon/ttsc#1390). Releasing the lock without
    // publishing lets the next waiter compile.
    if (sharedClaim !== undefined) {
      if (walkStable && result.type !== "exception") {
        await sharedClaim.publish({
          externalInputHashes: externalInputSnapshot.hashes,
          externalInputRealpaths: externalInputSnapshot.realpaths,
          result,
          scratchDirectory,
          ...(temporaryTsconfig === undefined ? {} : { temporaryTsconfig }),
        });
      }
      sharedClaim.release();
    }
    // An adopted compile holds only while every external input still has the
    // state its publisher recorded after compiling. Recording this worker's
    // own reading instead would claim the compile saw inputs it never read.
    const adoptionFailure =
      adopted === undefined
        ? undefined
        : adoptedExternalInputMismatch(adopted, externalInputSnapshot);
    // An adopted compile whose external inputs have moved since its publisher
    // read them, or whose graph proofs this worker cannot confirm against its
    // own disk, is a verdict about a state already gone, whatever the verdict
    // was: a failure adopted from the session is compiled again like one whose
    // own project moved (samchon/ttsc#1458).
    if (
      adopted !== undefined &&
      (adoptionFailure !== undefined || !externalInputSnapshot.complete)
    ) {
      cached.projectHeldStill = false;
    }
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
    if (adoptionFailure !== undefined) {
      recordGenerationProofFailure(failures, {
        domain: "external",
        kind: "adopted-state-changed",
        path: adoptionFailure,
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
      adoptionFailure === undefined &&
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
      props.retainNotifications &&
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
    // Waiters must never block on a lock whose holder threw.
    sharedClaim?.release();
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
