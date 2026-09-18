import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";
import { resolveFilesystemPath } from "ttsc/path-identity";

import { resultFilesystem } from "../cache/resultFilesystem";
import { sameHostInputRealpath } from "../inputs/sameHostInputRealpath";
import { isDeclarationFile } from "../utils/isDeclarationFile";
import type { TtscEnvelopeDerivation } from "./TtscEnvelopeDerivation";
import type { TtscEnvelopeGraphIndexes } from "./TtscEnvelopeGraphIndexes";
import { derivationIdentity } from "./derivationIdentity";
import { graphInputObservationCompatible } from "./graphInputObservationCompatible";
import { legacyProjectionOfGraphInputObservation } from "./legacyProjectionOfGraphInputObservation";
import { normalizeGraphInputObservation } from "./normalizeGraphInputObservation";
import { selectListedFiles } from "./selectListedFiles";

/**
 * Build the reference-graph indexes of one envelope on first watch-input
 * derivation. Malformed sections are dropped member by member, mirroring the
 * historical per-delivery scan.
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
      entries.push(
        ...targets
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
          }),
      );
      built.edges.set(identity, entries);
    }
    built.globals.push(...selectListedFiles(props.projectRoot, graph.globals));
    built.configs.push(...selectListedFiles(props.projectRoot, graph.configs));
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
    built.resolutionInputs.push(
      ...selectListedFiles(props.projectRoot, graph.resolutionInputs),
    );
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

/** Join duplicate lexical keys only when every repeated predicate agrees. */
function mergeGraphInputObservations(
  left: ITtscCompilerTransformation.IInputObservation,
  right: ITtscCompilerTransformation.IInputObservation,
): ITtscCompilerTransformation.IInputObservation | undefined {
  for (const property of [
    "accessibleEntries",
    "directoryExists",
    "fileExists",
    "readFile",
    "realpath",
    "stat",
  ] as const) {
    if (
      left[property] !== undefined &&
      right[property] !== undefined &&
      JSON.stringify(left[property]) !== JSON.stringify(right[property])
    ) {
      return undefined;
    }
  }
  const merged = { ...left, ...right };
  return graphInputObservationCompatible(merged) ? merged : undefined;
}
