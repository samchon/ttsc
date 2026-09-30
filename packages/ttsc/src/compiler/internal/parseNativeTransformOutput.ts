import path from "node:path";

import type { ITtscCompilerDiagnostic } from "../../structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerTransformation } from "../../structures/ITtscCompilerTransformation";

/**
 * Parse the JSON envelope written by the native transform host to stdout.
 *
 * The `typescript` field must be a `Record<string, string>`. Any other shape is
 * treated as a protocol error and throws with the stderr/stdout context. JSON
 * parse errors are also wrapped with the same context message.
 *
 * The optional `dependencies`, `dependenciesComplete`, `graph`, `sourceMaps`,
 * and `volatile` fields (see `ITtscCompilerTransformation`) are forwarded when
 * well-formed; entries that do not match the expected shape are dropped rather
 * than failing the transform — the fields are advisory invalidation metadata,
 * not output.
 *
 * Dropping a malformed `dependenciesComplete` member is the safe direction on
 * purpose: an unlisted file keeps the sound host-owned bound, so a garbled
 * declaration costs over-invalidation, never a stale output.
 *
 * Observation limits have a stricter protocol: completeness is only explicit
 * false, and per-input reasons require absolute native paths and the supported
 * unavailable reason. Invalid limit metadata fails instead of becoming an
 * exemption; omission asserts no completeness.
 *
 * @evidence contracts/common.md#principled-implementation Required source output is decoded as an object of strings; advisory members are retained only by their declared shape, while malformed observation exemptions fail rather than authorize reuse.
 * @evidence contracts/common.md#clear-and-simple-design This decoder owns the wire shape independently of process execution and proof revalidation; private helpers validate the distinct optional sections.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing or malformed source output is never synthesized; omission of optional metadata cannot create observation authority.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain required output, advisory filtering, stricter observation limits and diagnostic context; returned fields distinguish source text from producer claims.
 * @evidence contracts/portability.md#os-neutral-implementation Host proof paths use native path.isAbsolute and path.resolve; graph keys retain compiler spellings. Decoding opens no file or process and applies no platform case folding.
 * @evidence contracts/performance.md#efficient-algorithms JSON decoding and section filtering traverse the input bytes and section entries once; predicate consistency checks inspect a fixed number of fields per observation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each captured producer response is independently decoded; the function retains no result or validity proof for later requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Decoded records are request-owned and transfer to the caller; no response history, watcher or native handle survives in the decoder.
 */
export function parseNativeTransformOutput(
  /** Captured standard output containing the native JSON envelope. */
  stdout: string,
  /** Captured standard error used when no JSON response can be decoded. */
  stderr: string,
): {
  /** Advisory per-file dependency lists. */
  dependencies?: Record<string, string[]>;
  /** Files the producer declares dependency-complete. */
  dependenciesComplete?: string[];
  /** Diagnostic entries reported by the native response. */
  diagnostics: ITtscCompilerDiagnostic[];
  /** Advisory compiler graph and its recorded witnesses. */
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  /** Raw-content or unavailable-state host witnesses. */
  hostInputHashes?: Record<string, string | null>;
  /** Native physical-target or unavailable-state host witnesses. */
  hostInputRealpaths?: Record<string, string | null>;
  /** Explicit reports that host observation was unavailable. */
  hostInputProofFailures?: Record<string, "observation-unavailable">;
  /** Host input paths whose proof must be checked by the caller. */
  hostInputs?: string[];
  /** Explicit false withdraws complete observation authority. */
  observationsComplete?: false;
  /** Validated maps for returned TypeScript source texts. */
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  /** Required transformed TypeScript source texts. */
  typescript: Record<string, string>;
  /** Producer-selected sources unsuitable for stable reuse. */
  volatile?: string[];
} {
  try {
    const parsed = JSON.parse(stdout) as {
      dependencies?: Record<string, string[]>;
      dependenciesComplete?: string[];
      diagnostics?: ITtscCompilerDiagnostic[];
      graph?: ITtscCompilerTransformation.IReferenceGraph;
      hostInputHashes?: Record<string, string | null>;
      hostInputRealpaths?: Record<string, string | null>;
      hostInputProofFailures?: unknown;
      hostInputs?: string[];
      observationsComplete?: unknown;
      sourceMaps?: unknown;
      typescript?: Record<string, string>;
      volatile?: string[];
    };
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed) ||
      !isTextRecord(parsed.typescript)
    ) {
      throw new Error(
        "ttsc: native transform host did not return a TypeScript source map",
      );
    }
    if (
      parsed.observationsComplete !== undefined &&
      parsed.observationsComplete !== false
    ) {
      throw new Error("ttsc: invalid native observation-completeness marker");
    }
    const hostInputProofFailures = parseObservationUnavailable(
      parsed.hostInputProofFailures,
    );
    const dependencies = parseDependencyLists(parsed.dependencies);
    const dependenciesComplete = parseFileList(parsed.dependenciesComplete);
    const graph = parseReferenceGraph(parsed.graph);
    const hostInputHashes = parseHostInputHashes(parsed.hostInputHashes);
    const hostInputRealpaths = parseHostInputRealpaths(
      parsed.hostInputRealpaths,
    );
    const hostInputs = parseFileList(parsed.hostInputs);
    const sourceMaps = parseSourceMaps(parsed.sourceMaps, parsed.typescript);
    const volatile = parseFileList(parsed.volatile);
    return {
      ...(dependencies === undefined ? {} : { dependencies }),
      ...(dependenciesComplete === undefined ? {} : { dependenciesComplete }),
      ...(graph === undefined ? {} : { graph }),
      ...(hostInputHashes === undefined ? {} : { hostInputHashes }),
      ...(hostInputRealpaths === undefined ? {} : { hostInputRealpaths }),
      ...(hostInputProofFailures === undefined
        ? {}
        : { hostInputProofFailures }),
      ...(parsed.observationsComplete === false
        ? { observationsComplete: false as const }
        : {}),
      ...(hostInputs === undefined ? {} : { hostInputs }),
      ...(sourceMaps === undefined ? {} : { sourceMaps }),
      ...(volatile === undefined ? {} : { volatile }),
      diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
      typescript: parsed.typescript,
    };
  } catch (error) {
    if (error instanceof Error && !(error instanceof SyntaxError)) {
      throw error;
    }
    throw new Error(
      (stderr || stdout).trim() ||
        "ttsc: native transform host returned no output",
    );
  }
}

/**
 * Decode only explicit producer reports of unavailable host observation.
 * Absolute native input keys and the one supported reason are required;
 * malformed reports fail rather than weakening mutation admission.
 */
function parseObservationUnavailable(
  value: unknown,
): Record<string, "observation-unavailable"> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("ttsc: invalid native host-observation failure record");
  }
  const output: Record<string, "observation-unavailable"> = Object.create(null);
  for (const [file, reason] of Object.entries(value)) {
    if (!path.isAbsolute(file) || reason !== "observation-unavailable") {
      throw new Error("ttsc: invalid native host-observation failure entry");
    }
    output[path.resolve(file)] = reason;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Parse the envelope's per-file source maps (samchon/ttsc#1392).
 *
 * An entry survives only when it is a version 3 map with string `mappings`,
 * string `sources` and `names`, and a `sourcesContent` of strings or nulls, for
 * a file the envelope also carries text for. Anything else is dropped: a map a
 * consumer cannot read is no better than none.
 */
function parseSourceMaps(
  value: unknown,
  typescript: Record<string, string>,
): Record<string, ITtscCompilerTransformation.ISourceMap> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const isStrings = (list: unknown): list is string[] =>
    Array.isArray(list) && list.every((entry) => typeof entry === "string");
  const output: Record<string, ITtscCompilerTransformation.ISourceMap> = {};
  for (const [file, map] of Object.entries(value)) {
    if (
      !Object.prototype.hasOwnProperty.call(typescript, file) ||
      typeof map !== "object" ||
      map === null
    ) {
      continue;
    }
    const candidate = map as Record<string, unknown>;
    if (
      candidate.version !== 3 ||
      typeof candidate.mappings !== "string" ||
      !isStrings(candidate.sources) ||
      !isStrings(candidate.names) ||
      (candidate.file !== undefined && typeof candidate.file !== "string") ||
      (candidate.sourceRoot !== undefined &&
        typeof candidate.sourceRoot !== "string") ||
      (candidate.sourcesContent !== undefined &&
        !(
          Array.isArray(candidate.sourcesContent) &&
          candidate.sourcesContent.every(
            (entry) => entry === null || typeof entry === "string",
          )
        ))
    ) {
      continue;
    }
    output[file] =
      candidate as unknown as ITtscCompilerTransformation.ISourceMap;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse native evaluation-time SHA-256/null host-input fingerprints. */
function parseHostInputHashes(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(value)) {
    if (
      !path.isAbsolute(file) ||
      (hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)))
    ) {
      continue;
    }
    output[path.resolve(file)] = hash;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse native evaluation-time realpath/null host-input identities. */
function parseHostInputRealpaths(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(value)) {
    if (
      !path.isAbsolute(file) ||
      (realpath !== null &&
        (typeof realpath !== "string" || !path.isAbsolute(realpath)))
    ) {
      continue;
    }
    output[path.resolve(file)] =
      realpath === null ? null : path.resolve(realpath as string);
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize the optional `dependencies` envelope field into a record of string
 * arrays, or `undefined` when absent or carrying nothing usable.
 */
function parseDependencyLists(
  value: unknown,
): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) {
      continue;
    }
    const files = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
    if (files.length !== 0) {
      output[key] = files;
    }
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize graph adjacency while retaining every well-formed node key.
 *
 * A leaf is intentionally encoded as an empty target array. Its key still
 * declares graph membership and lets persistent hosts bind the compiler-time
 * input proof for that source. A node needs a non-empty source key and an array
 * value; invalid array members are filtered without erasing a valid node.
 */
function parseGraphEdges(value: unknown): Record<string, string[]> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string[]> = {};
  for (const [key, entries] of Object.entries(value)) {
    if (key.length === 0 || !Array.isArray(entries)) {
      continue;
    }
    output[key] = entries.filter(
      (entry): entry is string => typeof entry === "string",
    );
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize the optional `graph` envelope section with the same tolerance as
 * `dependencies`: non-object sections are dropped, empty source keys and edge
 * entries that are not arrays are dropped, and non-string list members are
 * filtered. Empty arrays remain as graph nodes because leaf membership binds
 * compiler input proof. A section carrying nothing usable collapses to
 * `undefined`.
 *
 * Optional resolver-input members are left off when empty. A consumer that
 * narrows on their declared optional types therefore sees the same shape from
 * the decoded envelope and the wire.
 */
function parseReferenceGraph(
  value: unknown,
): ITtscCompilerTransformation.IReferenceGraph | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const section = value as {
    candidates?: unknown;
    configs?: unknown;
    edges?: unknown;
    globals?: unknown;
    inputHashes?: unknown;
    inputObservations?: unknown;
    inputProofFailures?: unknown;
    inputRealpaths?: unknown;
    resolutionInputs?: unknown;
    useCaseSensitiveFileNames?: unknown;
  };
  const candidates = parseDependencyLists(section.candidates) ?? {};
  const edges = parseGraphEdges(section.edges) ?? {};
  const globals = parseFileList(section.globals) ?? [];
  const configs = parseFileList(section.configs) ?? [];
  const resolutionInputs = parseFileList(section.resolutionInputs) ?? [];
  const inputHashes = parseGraphInputHashes(section.inputHashes);
  const parsedInputObservations = parseGraphInputObservations(
    section.inputObservations,
  );
  const reportedInputProofFailures = parseGraphInputProofFailures(
    section.inputProofFailures,
  );
  const inputProofFailures = {
    ...reportedInputProofFailures,
    ...parsedInputObservations.failures,
  };
  const inputRealpaths = parseGraphInputRealpaths(section.inputRealpaths);
  if (
    Object.keys(candidates).length === 0 &&
    Object.keys(edges).length === 0 &&
    globals.length === 0 &&
    configs.length === 0 &&
    resolutionInputs.length === 0
  ) {
    return undefined;
  }
  return {
    ...(Object.keys(candidates).length === 0 ? {} : { candidates }),
    configs,
    edges,
    globals,
    ...(resolutionInputs.length === 0 ? {} : { resolutionInputs }),
    ...(inputHashes === undefined ? {} : { inputHashes }),
    ...(parsedInputObservations.observations === undefined
      ? {}
      : { inputObservations: parsedInputObservations.observations }),
    ...(Object.keys(inputProofFailures).length === 0
      ? {}
      : { inputProofFailures }),
    ...(inputRealpaths === undefined ? {} : { inputRealpaths }),
    // The compiler's case policy, kept only as the boolean it reports
    // (samchon/ttsc#1545).
    ...(typeof section.useCaseSensitiveFileNames === "boolean"
      ? { useCaseSensitiveFileNames: section.useCaseSensitiveFileNames }
      : {}),
  };
}

/**
 * Parse graph-keyed predicate observations and retain malformed entries as
 * failures.
 */
function parseGraphInputObservations(value: unknown): {
  failures?: Record<string, string>;
  observations?: Record<string, ITtscCompilerTransformation.IInputObservation>;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  const failures: Record<string, string> = {};
  const observations: Record<
    string,
    ITtscCompilerTransformation.IInputObservation
  > = {};
  for (const [file, entry] of Object.entries(value)) {
    if (file.length === 0) continue;
    const parsed = parseGraphInputObservation(entry);
    if (parsed === "malformed" || parsed === "conflicting") {
      failures[file] = `${parsed}-observation`;
    } else {
      observations[file] = parsed;
    }
  }
  return {
    ...(Object.keys(failures).length === 0 ? {} : { failures }),
    ...(Object.keys(observations).length === 0 ? {} : { observations }),
  };
}

/** Parse one predicate observation without guessing around a malformed member. */
function parseGraphInputObservation(
  value: unknown,
): ITtscCompilerTransformation.IInputObservation | "conflicting" | "malformed" {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "malformed";
  }
  const entry = value as Record<string, unknown>;
  const observation: ITtscCompilerTransformation.IInputObservation = {};
  if (Object.prototype.hasOwnProperty.call(entry, "accessibleEntries")) {
    const accessible = entry.accessibleEntries;
    if (
      typeof accessible !== "object" ||
      accessible === null ||
      Array.isArray(accessible)
    ) {
      return "malformed";
    }
    const lists = accessible as Record<string, unknown>;
    if (
      !Array.isArray(lists.directories) ||
      !lists.directories.every(
        (name): name is string => typeof name === "string",
      ) ||
      !Array.isArray(lists.files) ||
      !lists.files.every((name): name is string => typeof name === "string")
    ) {
      return "malformed";
    }
    observation.accessibleEntries = {
      directories: [...lists.directories],
      files: [...lists.files],
    };
  }
  if (Object.prototype.hasOwnProperty.call(entry, "fileExists")) {
    if (typeof entry.fileExists !== "boolean") return "malformed";
    observation.fileExists = entry.fileExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "directoryExists")) {
    if (typeof entry.directoryExists !== "boolean") return "malformed";
    observation.directoryExists = entry.directoryExists;
  }
  if (Object.prototype.hasOwnProperty.call(entry, "stat")) {
    if (!["directory", "file", "missing"].includes(entry.stat as string)) {
      return "malformed";
    }
    observation.stat = entry.stat as "directory" | "file" | "missing";
  }
  if (Object.prototype.hasOwnProperty.call(entry, "readFile")) {
    const read = entry.readFile;
    if (typeof read !== "object" || read === null || Array.isArray(read)) {
      return "malformed";
    }
    const result = read as Record<string, unknown>;
    if (result.ok === false && result.hash === undefined) {
      observation.readFile = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.hash === "string" &&
      /^[0-9a-f]{64}$/.test(result.hash)
    ) {
      observation.readFile = { hash: result.hash, ok: true };
    } else {
      return "malformed";
    }
  }
  if (Object.prototype.hasOwnProperty.call(entry, "realpath")) {
    const realpath = entry.realpath;
    if (
      typeof realpath !== "object" ||
      realpath === null ||
      Array.isArray(realpath)
    ) {
      return "malformed";
    }
    const result = realpath as Record<string, unknown>;
    if (result.ok === false && result.path === undefined) {
      observation.realpath = { ok: false };
    } else if (
      result.ok === true &&
      typeof result.path === "string" &&
      path.isAbsolute(result.path)
    ) {
      observation.realpath = { ok: true, path: path.resolve(result.path) };
    } else {
      return "malformed";
    }
  }
  if (Object.keys(observation).length === 0) return "malformed";
  return graphInputObservationCompatible(observation)
    ? observation
    : "conflicting";
}

/** Whether one predicate set can describe a single stable filesystem state. */
function graphInputObservationCompatible(
  observation: ITtscCompilerTransformation.IInputObservation,
): boolean {
  const { accessibleEntries, directoryExists, fileExists, readFile, stat } =
    observation;
  const hasAccessibleEntries =
    accessibleEntries !== undefined &&
    (accessibleEntries.directories.length !== 0 ||
      accessibleEntries.files.length !== 0);
  if (
    hasAccessibleEntries &&
    (fileExists === true ||
      directoryExists === false ||
      (stat !== undefined && stat !== "directory") ||
      readFile?.ok === true)
  ) {
    return false;
  }
  if (fileExists === true && directoryExists === true) return false;
  if (
    stat === "directory" &&
    (fileExists === true || directoryExists === false)
  ) {
    return false;
  }
  if (stat === "file" && (fileExists === false || directoryExists === true)) {
    return false;
  }
  if (stat === "missing" && (fileExists === true || directoryExists === true)) {
    return false;
  }
  if (
    readFile?.ok === true &&
    (fileExists === false ||
      directoryExists === true ||
      (stat !== undefined && stat !== "file"))
  ) {
    return false;
  }
  return true;
}

/** Parse graph-keyed machine-readable compiler proof-failure reasons. */
function parseGraphInputProofFailures(
  value: unknown,
): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string> = {};
  for (const [file, reason] of Object.entries(value)) {
    if (
      file.length === 0 ||
      typeof reason !== "string" ||
      !/^[a-z0-9-]{1,64}$/.test(reason)
    ) {
      continue;
    }
    output[file] = reason;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse graph-keyed compiler-time content/null observations. */
function parseGraphInputHashes(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, hash] of Object.entries(value)) {
    if (
      file.length === 0 ||
      (hash !== null &&
        (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)))
    ) {
      continue;
    }
    output[file] = hash;
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/** Parse graph-keyed compiler-time physical/null identities. */
function parseGraphInputRealpaths(
  value: unknown,
): Record<string, string | null> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const output: Record<string, string | null> = {};
  for (const [file, realpath] of Object.entries(value)) {
    if (
      file.length === 0 ||
      (realpath !== null &&
        (typeof realpath !== "string" || !path.isAbsolute(realpath)))
    ) {
      continue;
    }
    output[file] = realpath === null ? null : path.resolve(realpath);
  }
  return Object.keys(output).length === 0 ? undefined : output;
}

/**
 * Normalize an optional string-list envelope field (`dependenciesComplete`,
 * `hostInputs`, `volatile`, and the `globals`/`configs` graph sections), or
 * `undefined` when absent or carrying nothing usable.
 */
function parseFileList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const files = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.length !== 0,
  );
  return files.length === 0 ? undefined : files;
}

/** Type guard: true when `value` is a non-null, non-array object of strings. */
function isTextRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
