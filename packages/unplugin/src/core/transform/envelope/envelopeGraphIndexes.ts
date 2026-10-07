import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import { TRANSFORM_RESULT_MEMBERSHIP } from "../cache/TRANSFORM_RESULT_MEMBERSHIP";
import { resultFilesystem } from "../cache/resultFilesystem";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { isDeclarationFile } from "../utils/isDeclarationFile";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";
import { legacyProjectionOfGraphInputObservation } from "./legacyProjectionOfGraphInputObservation";
import { mergeGraphInputObservations } from "./mergeGraphInputObservations";
import { normalizeGraphInputObservation } from "./normalizeGraphInputObservation";
import { selectListedFiles } from "./selectListedFiles";

/**
 * Build the reference-graph indexes of one envelope on first watch-input
 * derivation. Malformed sections are dropped member by member, mirroring the
 * historical per-delivery scan.
 *
 * Identity-keyed adjacency supports reachability, while lexical proof keys
 * preserve the exact compiler predicate calls. Malformed or contradictory proof
 * records cannot become usable observations. Directory listings already
 * recorded as enumerated by a complete pre-compile membership walk are omitted
 * only when other predicates remain; universal resolver listings keep their
 * independent observation. Lexical policy eligibility alone supplies no such
 * traversal proof for linked or unreadable directories.
 *
 * @evidence contracts/common.md#principled-implementation The index separates physical graph membership from lexical predicates, normalizes untrusted proof shapes and makes conflicting duplicate observations permanently unusable; listing reduction requires the exact lexical path in a complete pre-compile enumeration under the matching compiler case policy, rather than mere path eligibility.
 * @evidence contracts/common.md#clear-and-simple-design One lazy builder centralizes graph and proof indexing; normalization, predicate compatibility and legacy projection remain delegated, while listing reduction checks the capture owner's already recorded enumeration set.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Edge sources preserve their latest recorded spelling while other member insertions retain an existing spelling; explicit conflict/failure sets prevent contradictory proof reuse. Malformed evidence is not patched with a later host observation or a consumer-specific expected hash.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish identity indexing, lexical predicates, malformed evidence and the directory-listing exception; inline reasons explain the nonobvious proof reductions with documentation-skill paragraph and tag separation.
 * @evidence contracts/portability.md#os-neutral-implementation Native project paths resolve through the shared identity context; reported realpaths use the producer filesystem's win32 or posix path semantics rather than blindly treating a foreign-platform spelling as a host path.
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Maps, arrays and copied predicate lists remain in the weakly owned
 *   generation state, with populations driven by graph entries, retained target
 *   occurrences and proof/list text. No independent historical cache or watcher
 *   handle is acquired. Temporary construction sets and serialization strings
 *   become collectible after construction; retained indexes leave with state.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Multiple linear passes collect edges, realized members, candidates and
 *   proofs so later candidate sources cannot be misclassified as speculative.
 *   Path resolution and memoized native identity add spelling/ancestor costs;
 *   normalization copies each reported list and duplicate merges serialize
 *   overlapping predicates, retaining their entry/text cost. Object.entries,
 *   filtered candidates, target arrays and selected sets allocate temporary
 *   population-sized storage. Maps and sets support keyed lookup; no per-module
 *   rebuild is needed for the immutable generation.
 * @evidence contracts/performance.md#reuse-equivalent-work state.graph stores the completed index once for an immutable envelope, root and membership snapshot; every delivery shares it without repeating producer parsing or filesystem identity resolution.
 */
export function envelopeGraphIndexes(
  state: TtscEnvelopeDerivation,
  props: {
    projectRoot: string;
    result: ITtscCompilerTransformation;
  },
): TtscEnvelopeGraphIndexes {
  if (state.graph !== undefined) {
    return state.graph;
  }
  const platform = resultFilesystem(props.result).platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const built: TtscEnvelopeGraphIndexes = {
    edges: new Map(),
    spellings: new Map(),
    candidates: [],
    globals: [],
    configs: [],
    resolutionInputs: [],
    memberSpellings: new Set(),
    speculative: new Set(),
    inputProofs: new Map(),
    inputProofFailures: new Map(),
    inputProofConflicts: new Set(),
    inputObservations: new Map(),
    inputObservationConflicts: new Set(),
  };
  const graph =
    props.result.type === "exception" ? undefined : props.result.graph;
  if (graph !== undefined) {
    for (const [source, targets] of Object.entries(graph.edges ?? {})) {
      if (!Array.isArray(targets)) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, source);
      const identity = derivationIdentity(state, absolute);
      built.memberSpellings.add(absolute);
      built.spellings.set(identity, absolute);
      const entries = built.edges.get(identity) ?? [];
      for (const entryToAppend of targets
        .filter(
          (target): target is string =>
            typeof target === "string" && target.length !== 0,
        )
        .map((target) => {
          const absoluteTarget = path.resolve(props.projectRoot, target);
          const targetIdentity = derivationIdentity(state, absoluteTarget);
          built.memberSpellings.add(absoluteTarget);
          if (!built.spellings.has(targetIdentity)) {
            built.spellings.set(targetIdentity, absoluteTarget);
          }
          return absoluteTarget;
        }))
        entries.push(entryToAppend);
      built.edges.set(identity, entries);
    }
    for (const entryToAppend of selectListedFiles(
      props.projectRoot,
      graph.globals,
    ))
      built.globals.push(entryToAppend);
    for (const entryToAppend of selectListedFiles(
      props.projectRoot,
      graph.configs,
    ))
      built.configs.push(entryToAppend);
    for (const input of [...built.globals, ...built.configs]) {
      const identity = derivationIdentity(state, input);
      built.memberSpellings.add(path.resolve(input));
      if (!built.spellings.has(identity)) built.spellings.set(identity, input);
    }
    const candidateEntries = Object.entries(graph.candidates ?? {}).filter(
      (entry) => Array.isArray(entry[1]),
    );
    // Every candidate source is an importing file the compiler read, so fold
    // the sources in before classifying any candidate. Otherwise one entry's
    // candidate could be classified speculative before a later entry proves
    // the same path is a realized source.
    for (const [source] of candidateEntries) {
      const absoluteSource = path.resolve(props.projectRoot, source);
      const identity = derivationIdentity(state, absoluteSource);
      built.memberSpellings.add(absoluteSource);
      if (!built.spellings.has(identity)) {
        built.spellings.set(identity, absoluteSource);
      }
    }
    const realized = new Set(built.memberSpellings);
    for (const entryToAppend of selectListedFiles(
      props.projectRoot,
      graph.resolutionInputs,
    ))
      built.resolutionInputs.push(entryToAppend);
    for (const input of built.resolutionInputs) {
      const spelling = path.resolve(input);
      const identity = derivationIdentity(state, input);
      if (!realized.has(spelling)) built.speculative.add(spelling);
      built.memberSpellings.add(spelling);
      if (!built.spellings.has(identity)) built.spellings.set(identity, input);
    }
    for (const [source, candidates] of candidateEntries) {
      built.candidates.push({
        source: derivationIdentity(
          state,
          path.resolve(props.projectRoot, source),
        ),
        files: selectListedFiles(props.projectRoot, candidates),
      });
      for (const candidate of candidates) {
        if (typeof candidate !== "string" || candidate.length === 0) continue;
        const absoluteCandidate = path.resolve(props.projectRoot, candidate);
        const identity = derivationIdentity(state, absoluteCandidate);
        // Edges, globals, configs, and every candidate source are folded in
        // above, so a path absent from that set is one the envelope reported
        // only as a candidate.
        if (!realized.has(absoluteCandidate)) {
          built.speculative.add(absoluteCandidate);
        }
        built.memberSpellings.add(absoluteCandidate);
        if (!built.spellings.has(identity)) {
          built.spellings.set(identity, absoluteCandidate);
        }
      }
    }
    const transformSourceSpellings = new Set<string>();
    if (props.result.type === "success") {
      for (const output of Object.keys(props.result.typescript)) {
        if (!isDeclarationFile(output)) {
          const absoluteOutput = path.resolve(props.projectRoot, output);
          transformSourceSpellings.add(absoluteOutput);
        }
      }
    }
    for (const [input, reported] of Object.entries(
      graph.inputObservations ?? {},
    )) {
      if (input.length === 0) continue;
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const normalized = normalizeGraphInputObservation(reported, platform);
      if (normalized === undefined) {
        built.inputObservationConflicts.add(spelling);
        if (!built.inputProofFailures.has(spelling)) {
          built.inputProofFailures.set(spelling, "malformed-observation");
        }
        continue;
      }
      const previous = built.inputObservations.get(spelling);
      const merged =
        previous === undefined
          ? normalized
          : mergeGraphInputObservations(previous, normalized);
      if (merged === undefined) {
        built.inputObservations.delete(spelling);
        built.inputObservationConflicts.add(spelling);
        if (!built.inputProofFailures.has(spelling)) {
          built.inputProofFailures.set(spelling, "conflicting-observation");
        }
      } else if (!built.inputObservationConflicts.has(spelling)) {
        built.inputObservations.set(spelling, merged);
      }
    }
    // The compiler's observer keeps every predicate anyone asked of a path, so
    // a directory the config's file list was expanded from carries its whole
    // listing wherever else it is an input: the project root is a module
    // resolution candidate, and it arrived listing `.next`, `AGENTS.md` and
    // ttsc's own tool directory. What that expansion depends on is the
    // program's root-file membership there, which the capture's own walk
    // proves under the same policy (`walkProjectInputs`), and proving the raw
    // listing instead failed the generation, measured on a Turbopack pool, for
    // every unrelated file a framework wrote beside the project. The listing is
    // kept where the complete pre-compile walk did not enumerate the exact
    // lexical directory, including skipped links and failed enumeration, where
    // automatic type discovery read it as a type root, which the walk does not
    // model, and where it is the only predicate the path carries.
    const membership = TRANSFORM_RESULT_MEMBERSHIP.get(props.result);
    if (membership !== undefined) {
      const universalInputs = new Set(
        built.resolutionInputs.map((input) => path.resolve(input)),
      );
      for (const [spelling, observation] of built.inputObservations) {
        if (
          observation.accessibleEntries === undefined ||
          universalInputs.has(spelling)
        ) {
          continue;
        }
        const { accessibleEntries: _listing, ...remaining } = observation;
        if (
          Object.values(remaining).every((value) => value === undefined) ||
          !membership.enumeratedDirectories.has(spelling)
        ) {
          continue;
        }
        built.inputObservations.set(spelling, remaining);
      }
    }
    for (const [input, hash] of Object.entries(graph.inputHashes ?? {})) {
      if (
        hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash))
      ) {
        continue;
      }
      if (
        graph.inputRealpaths === undefined ||
        !Object.prototype.hasOwnProperty.call(graph.inputRealpaths, input)
      ) {
        continue;
      }
      const reportedRealpath = graph.inputRealpaths[input];
      if (
        reportedRealpath !== null &&
        (typeof reportedRealpath !== "string" ||
          !pathApi.isAbsolute(reportedRealpath))
      ) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const proof = {
        hash,
        path: absolute,
        realpath:
          reportedRealpath === null
            ? null
            : resolveFilesystemPath(reportedRealpath, platform),
      };
      const previous = built.inputProofs.get(spelling);
      if (
        previous !== undefined &&
        (previous.hash !== proof.hash ||
          !sameHostInputRealpath(
            previous.realpath,
            proof.realpath,
            state.identityContext,
          ))
      ) {
        built.inputProofs.delete(spelling);
        built.inputProofConflicts.add(spelling);
      } else if (!built.inputProofConflicts.has(spelling)) {
        built.inputProofs.set(spelling, proof);
      }
    }
    for (const [input, reason] of Object.entries(
      graph.inputProofFailures ?? {},
    )) {
      if (typeof reason !== "string" || !/^[a-z0-9-]{1,64}$/.test(reason)) {
        continue;
      }
      const absolute = path.resolve(props.projectRoot, input);
      const spelling = path.resolve(absolute);
      if (
        !built.memberSpellings.has(spelling) &&
        !transformSourceSpellings.has(spelling)
      ) {
        continue;
      }
      const observation = built.inputObservations.get(spelling);
      const legacyProjection =
        observation === undefined
          ? undefined
          : legacyProjectionOfGraphInputObservation(observation);
      if (
        built.speculative.has(spelling) &&
        !built.inputProofs.has(spelling) &&
        legacyProjection?.failure === reason
      ) {
        continue;
      }
      if (built.inputObservations.has(spelling)) {
        built.inputObservations.delete(spelling);
        built.inputObservationConflicts.add(spelling);
      }
      if (built.inputProofs.has(spelling)) {
        built.inputProofs.delete(spelling);
        built.inputProofConflicts.add(spelling);
      }
      if (!built.inputProofFailures.has(spelling)) {
        built.inputProofFailures.set(spelling, reason);
      }
    }
  }
  state.graph = built;
  return built;
}
