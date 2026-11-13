import fs from "node:fs";
import path from "node:path";

import { readCompilerOptionOccurrence } from "../../../flags/readCompilerOptionOccurrence";
import { resolveFlagSpec } from "../../../flags/resolveFlagSpec";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { CompilerArgumentsInspection } from "../CompilerArgumentsInspection";
import { ensureExecutable } from "../ensureExecutable";
import { spawnNative } from "../spawnNative";
import { CompilerDiagnostics } from "./CompilerDiagnostics";
import { PassthroughFlags } from "./PassthroughFlags";

/**
 * Observe emitted-source ownership around the selected external compiler. The
 * callback runs the original producer once, with file-list reporting added only
 * when its read-only option probe succeeded. Compiler status, diagnostics and
 * user-requested file-list display remain owned by that run.
 *
 * A reporting producer names, in that one run, every source of its Program
 * (`--listFiles`) and every file it wrote (`--listEmittedFiles`); its own list
 * is the selection, so no second compiler run lists it beforehand
 * (samchon/ttsc#1859). Each written JavaScript file is owned by the one listed
 * source whose output the effective layout predicts at that name, resolved to
 * its physical path once per directory. Response files and the selected
 * executable bytes must be unchanged across the run. The layout is the one read
 * before the run; the runtime builds that require provenance pin their output
 * directory and root on the command line, and an output whose name the layout
 * cannot predict stays unowned rather than guessed.
 *
 * An observed host, which cannot report, is listed and resolved before it runs
 * and inspected again after: its effective options and physical source paths
 * must hold, and when its shown roots change, the union of inspected source
 * populations must still predict a unique physical owner for each previously
 * predicted write; new sources can only introduce ambiguity. Response
 * inspection preserves native argument-frame boundaries and operand positions;
 * the producer and its probes receive the original argv. The executable's
 * change time is excluded from cross-command equality because that metadata
 * changed in real executions without changing the executable object or bytes;
 * source contents belong to the compiler's own Program. Each executable read
 * brackets its full metadata. This is an external observation, not an atomic
 * compiler-generation ledger; a concurrent change restored between observations
 * can remain invisible. Unsupported layouts and ambiguous outputs carry an
 * empty ownership list.
 *
 * A nonzero compiler status can still carry proved writes for an unchecked
 * consumer. Ownership metadata never changes that status or its diagnostics.
 * Profiling and tracing options suppress probes so their artifacts remain owned
 * by the emitting run. TSFILE rows are the selected producer's write reports,
 * not output-file byte observations. Admission assumes that producer uses the
 * supported upstream naming subset; this adapter does not certify arbitrary
 * compiler behavior.
 *
 * A foreign compiler host that cannot report its writes, a plugin library's own
 * executable built before ttsc required provenance, is observed instead: the
 * selected tsgo answers the same read-only probes, the host runs unchanged, and
 * its writes are the predicted outputs whose metadata moved across the run.
 * Requiring provenance must never reject such a host outright.
 *
 * Normally reported ownerless outputs carry their actual failed proof boundary
 * in emittedSourceProofFailures. These explanations preserve compiler streams
 * and status; they do not replace missing ownership with a successful claim.
 *
 * @evidence contracts/common.md#principled-implementation Actual TSFILE writes are matched against the supported upstream per-source extension and explicit-root layout over the sources the same run listed, with physical identities and response/executable content observations. Parsed settings exclude rediscovered showConfig.files. A reporting producer proves its emitting selection in its own run; an observed host with changed roots rechecks source selection and includes additional candidates only to reject conflicting physical owners of previously predicted writes. No emitted filename alone establishes ownership; observation gaps remain documented.
 * @evidence contracts/common.md#clear-and-simple-design One adapter owns read-only compiler probes, the single delegated emission and admission; private helpers isolate option parsing, physical observation and path prediction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The selected executable and original arguments remain authoritative. Unknown layouts are reported unknown instead of switching compilers, guessing same-stem ownership or consulting source maps.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain producer preservation, unknown states and the non-atomic observation limitation; the investigation record documents the supported upstream naming subset.
 * @evidence contracts/portability.md#os-neutral-implementation Native node:path and filesystem realpath/stat separate writer spelling from physical source identity. Executables receive separate argv entries through spawnNative, without a shell or OS-based case folding.
 * @evidence contracts/performance.md#efficient-algorithms A reporting producer costs one showConfig query and the emitting run; its sources are resolved only when they own a written output, with one native resolution and one listing per directory and one lstat per owning file. Source and output indexes avoid cross-product matching; changed observed roots add one native source probe and a deduplicated union of the two populations. Response inspection uses an iterative frame stack and active physical-path set. Response/executable observations read and hash complete files; showConfig text, source/output lists, signature JSON, candidate path components and byte buffers are processed at their actual sizes. No native duration or report-size ceiling follows from using one index.
 * @evidence contracts/performance.md#reuse-equivalent-work Each source observation and predicted output index is shared by all outputs in this invocation. Cross-build reuse is unavailable because arbitrary external producer and filesystem dependencies have no invalidation contract.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Response/config/source tokens and predicted owner sets live for this invocation; returned provenance/refusal records transfer to the caller. Retained bytes grow with complete reports, expanded arguments, paths and observations, while individual file reads allocate full file buffers. Probe capture cleanup is delegated and may be best effort; no timeout, output ceiling or descendant-release certification is provided here.
 */
export function runExternalEmitProvenance(options: {
  /** Complete original compiler argv, including project selection. */
  args: readonly string[];

  /** Selected external executable; provenance never substitutes a producer. */
  binary: string;

  /** Native working directory shared by probes and the emitting command. */
  cwd: string;

  /** Same child environment used by the emitting command. */
  env: NodeJS.ProcessEnv;

  /** Capture the read-only probes through pipes; see `spawnNative`. */
  pipe?: boolean;

  /**
   * How the emitting command's writes are known. `reported` (the default) reads
   * the producer's own `TSFILE:` rows. `observed` serves a foreign compiler
   * host that cannot report them, a plugin library's own executable such as
   * typia's: `binary` and `args` then only drive the read-only probes, the
   * callback runs that host unchanged, and a write is a predicted output whose
   * metadata moved across the run.
   */
  writes?: "reported" | "observed";

  /**
   * Execute the single emitting command, preserving raw output and whether the
   * child exited normally rather than being killed during reporting.
   */
  run: (args: readonly string[]) => {
    /** Original process facts and diagnostics, without status reinterpretation. */
    result: TtscBuildResult;

    /** Native status was present and no terminating signal truncated reporting. */
    completedNormally: boolean;
  };
}): TtscBuildResult {
  let refusal = "External compiler provenance inspection did not complete.";
  const observed = options.writes === "observed";
  // A reporting producer names its own sources in the emitting run, so only a
  // host that cannot report them is listed beforehand (samchon/ttsc#1859).
  const probe = prepareProbe(
    options,
    (reason) => {
      refusal = reason;
    },
    observed,
  );
  const outputsBefore =
    observed && probe !== undefined
      ? observePredictedOutputs(probe)
      : undefined;
  const { result, completedNormally } = options.run(
    probe === undefined || observed
      ? options.args
      : [...options.args, "--listFiles", "true", "--listEmittedFiles", "true"],
  );
  const lines = result.stdout.split(/\r?\n/);
  // An observed host lists nothing; it compiles the same selected tsconfig, and
  // the source identity observations below still prove that selection retained
  // its physical owners. A reporting producer's own listing is its selection.
  const listed =
    probe === undefined
      ? []
      : observed
        ? probe.files
        : compilerSourceList(lines, options.cwd);
  const sourceLines = new Set(observed ? [] : listed);
  const stdout =
    probe === undefined ||
    observed ||
    probe.config.compilerOptions.listFiles === true
      ? result.stdout
      : result.stdout
          .split(/(?<=\n)/)
          .filter((line) => !sourceLines.has(line.replace(/\r?\n$/, "")))
          .join("");
  if (!completedNormally)
    return {
      ...result,
      emittedSources: undefined,
      emittedSourceProofFailures: undefined,
      stdout,
    };
  const written =
    outputsBefore !== undefined
      ? movedOutputs(outputsBefore)
      : observed
        ? []
        : writtenJavaScript(result.stdout, options.cwd);
  const emittedSources: Record<string, readonly string[]> = Object.create(null);
  const emittedSourceProofFailures: Record<string, string> =
    Object.create(null);
  for (const output of written) emittedSources[output] = [];
  if (probe === undefined) {
    for (const output of written) emittedSourceProofFailures[output] = refusal;
    return {
      ...result,
      ...(written.length === 0 ? {} : { emittedSources }),
      emittedSourceProofFailures:
        written.length === 0 ? undefined : emittedSourceProofFailures,
    };
  }

  let stable = observed || listed.length !== 0;
  let failure = stable
    ? undefined
    : "The emitting run reported no source selection.";
  let stage = "response-file reinspection";
  try {
    let sources = listed;
    for (const [file, before] of probe.responseObservations) {
      if (!stable) break;
      stable = CompilerArgumentsInspection.observeInputFile(file) === before;
      if (!stable)
        failure = `Compiler response file changed across emission: ${JSON.stringify(file)}.`;
    }
    stage = "effective configuration reinspection";
    // Ownership is predicted from the configuration read before the run. A
    // configuration edited during it could move the layout, and a moved
    // root can make one source's output land where the earlier layout puts
    // another's, so it is read again, unless the command line fixes both the
    // output directory and the root, as every ttsx runtime build's does.
    if (stable && (observed || !probe.layoutPinned)) {
      const after = readConfig(options);
      if (after?.signature !== probe.signature) {
        stable = false;
        failure =
          "Effective configuration changed or could not be reinspected after emission.";
      } else if (
        observed &&
        JSON.stringify(after.config.files) !==
          JSON.stringify(probe.config.files)
      ) {
        stage = "post-emission source-list inspection";
        // An added root can import an output-colliding source, so inspect its
        // full dependency selection rather than only predicting that root.
        sources = [...new Set([...sources, ...readSourceList(options)])];
      }
    }
    stage = `executable observation of ${JSON.stringify(probe.binaryPath)}`;
    if (stable) {
      const after = CompilerArgumentsInspection.observeInputFile(
        probe.binaryPath,
        "executable",
      );
      if (after !== probe.binaryObservation) {
        stable = false;
        failure = `Selected executable changed across emission: ${JSON.stringify(probe.binaryPath)} (${observationDifference(probe.binaryObservation, after)}).`;
      }
    }
    for (const [source, before] of probe.observations) {
      if (!stable) break;
      stage = `source observation of ${JSON.stringify(source)}`;
      const after = observeSourceIdentity(source);
      stable = after === before;
      if (!stable)
        failure = `Selected source identity changed across emission: ${JSON.stringify(source)}.`;
    }
    for (const [file, before] of probe.responseObservations) {
      if (!stable) break;
      stable = CompilerArgumentsInspection.observeInputFile(file) === before;
      if (!stable)
        failure = `Compiler response file changed during post-emission inspection: ${JSON.stringify(file)}.`;
    }
    if (stable && written.length !== 0) {
      stage = "output prediction";
      const owners = new Map<string, Set<string>>();
      const predictOutputs = createOutputPrediction(probe.config, probe.base);
      const writes = new Set(written);
      const identity = createSourceIdentity();
      let predictedSources = 0;
      let sourceExample: string | undefined;
      for (const source of sources) {
        // Only a source whose predicted output was written is an owner, so
        // only those sources are resolved to their physical identity.
        const outputs = predictOutputs(source).filter((output) =>
          writes.has(output),
        );
        if (outputs.length === 0) continue;
        predictedSources++;
        sourceExample ??= source;
        // Observed writes were predicted before the host ran. A newly selected
        // source can make their ownership ambiguous, never establish a new write.
        const physicalSource =
          probe.observations.get(source) ?? identity(source);
        for (const output of outputs) {
          const sources = owners.get(output) ?? new Set<string>();
          sources.add(physicalSource);
          owners.set(output, sources);
        }
      }
      for (const output of written) {
        const candidates = owners.get(output);
        if (candidates?.size === 1) emittedSources[output] = [...candidates];
        else
          emittedSourceProofFailures[output] =
            candidates === undefined
              ? `No selected source predicts this writer (${predictedSources} predicted sources; example ${JSON.stringify(sourceExample)}) under rootDir ${JSON.stringify(probe.config.compilerOptions.rootDir)} and outDir ${JSON.stringify(probe.config.compilerOptions.outDir)}, anchored at ${JSON.stringify(probe.base)}.`
              : `${candidates.size} distinct physical source candidates predict this writer; complete contributor ownership is unknown.`;
      }
    }
  } catch (error) {
    stable = false;
    failure = `Provenance failed during ${stage}: ${error instanceof Error ? error.message : String(error)}.`;
    for (const output of written) emittedSources[output] = [];
  }
  if (!stable)
    for (const output of written) emittedSourceProofFailures[output] = failure!;
  return {
    ...result,
    ...(written.length > 0 || stable ? { emittedSources } : {}),
    emittedSourceProofFailures:
      Object.keys(emittedSourceProofFailures).length === 0
        ? undefined
        : emittedSourceProofFailures,
    stdout,
  };
}

/**
 * Append reporting only when it cannot supply a missing trailing option value.
 * `listSources` lists and resolves the selection before the producer runs,
 * which only a host that cannot report its own selection needs.
 */
function prepareProbe(
  options: Parameters<typeof runExternalEmitProvenance>[0],
  onUnavailable: (reason: string) => void,
  listSources: boolean,
) {
  let stage = "argument classification";
  const unavailable = (reason: string): undefined => {
    onUnavailable(reason);
    return undefined;
  };
  try {
    const inspected = CompilerArgumentsInspection.inspect(
      options.args,
      options.cwd,
    );
    if (
      PassthroughFlags.forwardsTerminalTsgoFlag({ passthrough: inspected.args })
    )
      return unavailable(
        "Original argv selects an effective terminal compiler command; provenance inspection would change its command behavior.",
      );
    let unsupportedArg: string | undefined;
    const pinned = new Set<string>();
    for (let index = 0; index < inspected.args.length; ) {
      const arg = inspected.args[index]!;
      const occurrence = readCompilerOptionOccurrence(inspected.args, index);
      const flag = resolveFlagSpec(arg);
      const name = occurrence.option?.name;
      if (name === "rootDir" || name === "outDir") pinned.add(name);
      if (
        flag?.name === "--build" ||
        name === "pprofDir" ||
        name === "generateCpuProfile" ||
        name === "generateTrace"
      ) {
        unsupportedArg = arg;
        break;
      }
      index += occurrence.width;
    }
    if (unsupportedArg !== undefined)
      return unavailable(
        `Original argv contains ${JSON.stringify(unsupportedArg)}, selecting a build command or profiling/tracing artifact option unsupported by read-only provenance inspection.`,
      );
    const binaryPath = path.resolve(options.cwd, options.binary);
    stage = `initial executable preparation and observation of ${JSON.stringify(binaryPath)}`;
    // Match spawnNative's native/script boundary before observing ctime: its
    // first POSIX permission preparation must not invalidate our own producer.
    if (!/\.(?:[cm]?js|ts)$/i.test(binaryPath)) ensureExecutable(binaryPath);
    const binaryObservation = CompilerArgumentsInspection.observeInputFile(
      binaryPath,
      "executable",
    );
    stage = "effective configuration inspection";
    const parsed = readConfig(options);
    if (parsed === undefined)
      return unavailable(
        "Selected producer could not return a supported effective configuration for the original argv.",
      );
    const { config } = parsed;
    const compilerOptions = config.compilerOptions;
    if (
      config.references?.length ||
      compilerOptions.outFile ||
      compilerOptions.generateTrace ||
      compilerOptions.generateCpuProfile ||
      compilerOptions.pprofDir ||
      compilerOptions.explainFiles === true ||
      (compilerOptions.outDir && typeof compilerOptions.rootDir !== "string") ||
      (compilerOptions.outDir !== undefined &&
        typeof compilerOptions.outDir !== "string") ||
      (compilerOptions.rootDir !== undefined &&
        typeof compilerOptions.rootDir !== "string") ||
      (compilerOptions.jsx !== undefined &&
        (typeof compilerOptions.jsx !== "string" ||
          ![
            "preserve",
            "react",
            "react-native",
            "react-jsx",
            "react-jsxdev",
          ].includes(compilerOptions.jsx)))
    )
      return unavailable(
        `Effective configuration selects unsupported provenance layout or reporting: ${JSON.stringify({ references: config.references?.length, outFile: compilerOptions.outFile, rootDir: compilerOptions.rootDir, outDir: compilerOptions.outDir, jsx: compilerOptions.jsx, explainFiles: compilerOptions.explainFiles, generateTrace: compilerOptions.generateTrace, generateCpuProfile: compilerOptions.generateCpuProfile, pprofDir: compilerOptions.pprofDir })}.`,
      );
    stage = "selected configuration anchor";
    const base = projectBase(inspected.args, options.cwd);
    if (base === undefined)
      return unavailable(
        "Original argv does not establish a supported selected configuration directory.",
      );
    stage = "compiler source-list inspection";
    const files = listSources ? readSourceList(options) : [];
    const observations = new Map<string, string>();
    for (const source of files) {
      stage = `initial source observation of ${JSON.stringify(source)}`;
      observations.set(source, observeSourceIdentity(source));
    }
    for (const [file, before] of inspected.observations)
      if (CompilerArgumentsInspection.observeInputFile(file) !== before)
        return unavailable(
          `Compiler response file changed during inspection: ${JSON.stringify(file)}.`,
        );
    return {
      ...parsed,
      base,
      layoutPinned: pinned.size === 2,
      binaryObservation,
      binaryPath,
      files,
      observations,
      responseObservations: inspected.observations,
    };
  } catch (error) {
    return unavailable(
      `Provenance inspection failed during ${stage}: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
}

/** Both source inspections use the same native reporting and admission rules. */
function readSourceList(
  options: Parameters<typeof runExternalEmitProvenance>[0],
): string[] {
  const listed = spawnNative(
    options.binary,
    [...options.args, "--listFilesOnly", "true", "--listEmittedFiles", "false"],
    options,
  );
  if (listed.error || listed.status === null || listed.signal !== null)
    throw new Error(
      `Selected producer source-list inspection did not complete normally (status ${listed.status}, signal ${listed.signal}, error ${listed.error?.message ?? "none"}).`,
    );
  const files = compilerSourceList(
    String(listed.stdout).split(/\r?\n/),
    options.cwd,
  );
  if (
    files.length === 0 ||
    !files.every(
      (file) =>
        path.isAbsolute(file) &&
        /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/.test(file),
    )
  )
    throw new Error(
      `Source-list inspection returned ${files.length} paths and no complete supported source population; first unsupported candidate: ${JSON.stringify(files.find((file) => !path.isAbsolute(file) || !/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/.test(file)))}.`,
    );
  return files;
}

/**
 * Compiler diagnostics may start with an absolute filename too. Exclude only
 * recognized diagnostic renderings, preserving every other absolute candidate
 * so an unknown source suffix makes admission unavailable rather than
 * vanishing.
 */
function compilerSourceList(lines: readonly string[], cwd: string): string[] {
  return lines.filter(
    (line) =>
      path.isAbsolute(line) &&
      CompilerDiagnostics.parseDiagnosticLine(
        CompilerDiagnostics.stripAnsi(line),
        cwd,
      ) === null,
  );
}

/**
 * ShowConfig resolves inherited settings and argv overrides in the producer.
 * Its expanded files describe the current directory, not the completed emit.
 * Root changes are handled separately from settings: reporting producers name
 * their emitting sources, while observed hosts recheck possible contributors.
 */
function readConfig(options: Parameters<typeof runExternalEmitProvenance>[0]):
  | {
      config: {
        compilerOptions: Record<string, unknown>;
        references?: unknown[];
        files?: string[];
      };
      signature: string;
    }
  | undefined {
  const result = spawnNative(
    options.binary,
    [...options.args, "--showConfig"],
    options,
  );
  if (result.error || result.status !== 0) return undefined;
  const config = JSON.parse(String(result.stdout));
  if (
    !config ||
    typeof config !== "object" ||
    !config.compilerOptions ||
    typeof config.compilerOptions !== "object" ||
    Array.isArray(config.compilerOptions) ||
    (config.references !== undefined && !Array.isArray(config.references))
  )
    return undefined;
  const settings = { ...config };
  delete settings.files;
  return { config, signature: JSON.stringify(settings) };
}

/** ShowConfig path options are relative to the selected config's directory. */
function projectBase(args: readonly string[], cwd: string): string | undefined {
  let selected: string | undefined;
  for (let index = 0; index < args.length; ) {
    const occurrence = readCompilerOptionOccurrence(args, index);
    if (resolveFlagSpec(args[index]!)?.name !== "--tsconfig") {
      index += occurrence.width;
      continue;
    }
    if (args[index]!.includes("=")) return undefined;
    selected = args[index + 1];
    if (
      typeof selected !== "string" ||
      occurrence.width !== 2 ||
      selected === "null"
    )
      return undefined;
    index += occurrence.width;
  }
  if (selected === undefined) return undefined;
  const project = path.resolve(cwd, selected);
  return fs.statSync(project).isDirectory() ? project : path.dirname(project);
}

/** Name only the changed identity premise; retain the original observation gate. */
function observationDifference(before: string, after: string): string {
  const [oldPath, oldSignature, oldHash] = JSON.parse(before) as [
    string,
    string,
    string,
  ];
  const [newPath, newSignature, newHash] = JSON.parse(after) as [
    string,
    string,
    string,
  ];
  const changes: string[] = [];
  if (oldPath !== newPath)
    changes.push(
      `physical path ${JSON.stringify(oldPath)} to ${JSON.stringify(newPath)}`,
    );
  const oldFields = oldSignature.split(":");
  const newFields = newSignature.split(":");
  for (const [index, name] of [
    "dev",
    "ino",
    "size",
    "mtimeNs",
    "ctimeNs",
  ].entries()) {
    if (oldFields[index] !== newFields[index])
      changes.push(`${name} ${oldFields[index]} to ${newFields[index]}`);
  }
  if (oldHash !== newHash) changes.push("SHA-256 content hash changed");
  return changes.join(", ") || "observation token changed";
}

/**
 * Prepare shared output layout once for every source in this invocation. Exact
 * containment establishes relocation and policy-independent component
 * mismatches establish adjacent output. Remaining case-policy uncertainty keeps
 * both branches as candidates; conflicting actual writer rows stay unknown.
 */
function createOutputPrediction(
  config: { compilerOptions: Record<string, unknown> },
  base: string,
): (source: string) => string[] {
  const options = config.compilerOptions;
  const outputDirectory =
    typeof options.outDir === "string" && options.outDir.length > 0
      ? path.resolve(base, options.outDir)
      : undefined;
  const root =
    typeof options.rootDir === "string"
      ? path.resolve(base, options.rootDir)
      : undefined;
  const prefix =
    root === undefined
      ? undefined
      : root.endsWith(path.sep)
        ? root
        : root + path.sep;
  const rootParts =
    root
      ?.split(path.sep)
      .filter(Boolean)
      .map((part) => ({
        ascii: /^[\x00-\x7f]*$/.test(part),
        lower: part.toLowerCase(),
      })) ?? [];
  const prefixBytes = prefix === undefined ? 0 : Buffer.byteLength(prefix);
  return (source) => {
    source = path.resolve(source);
    if (
      options.noEmit === true ||
      options.emitDeclarationOnly === true ||
      /\.d\.(?:ts|mts|cts)$/i.test(source)
    )
      return [];
    const extension = path.extname(source);
    if (
      ![".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"].includes(
        extension,
      )
    )
      return [];
    const outputExtension =
      extension === ".mts" || extension === ".mjs"
        ? ".mjs"
        : extension === ".cts" || extension === ".cjs"
          ? ".cjs"
          : options.jsx === "preserve" &&
              (extension === ".tsx" || extension === ".jsx")
            ? ".jsx"
            : ".js";
    const adjacent = source.slice(0, -extension.length) + outputExtension;
    if (outputDirectory === undefined) return [adjacent];
    if (prefix === undefined) return [];
    const sourceParts = source.split(path.sep).filter(Boolean);
    const certainlyOutside = rootParts.some((part, index) => {
      const sourcePart = sourceParts[index];
      if (sourcePart === undefined) return true;
      // Equal Unicode components need no folding. An ASCII component mismatch
      // under both case policies disproves containment, even when earlier shared
      // components contain Unicode. Other mismatches remain uncertain.
      return (
        part.ascii &&
        /^[\x00-\x7f]*$/.test(sourcePart) &&
        part.lower !== sourcePart.toLowerCase()
      );
    });
    if (certainlyOutside) return [adjacent];
    // Upstream removes the common directory by UTF-8 byte length, not UTF-16
    // character count; preserving that distinction matters for Unicode paths.
    const sourceBytes = Buffer.from(source);
    if (sourceBytes.length <= prefixBytes) return [adjacent];
    const suffix = sourceBytes.subarray(prefixBytes).toString("utf8");
    const relocated = path.resolve(outputDirectory, suffix);
    const output = relocated.slice(0, -extension.length) + outputExtension;
    return source.startsWith(prefix)
      ? [output]
      : [...new Set([adjacent, output])];
  };
}

/**
 * Every output the selected sources predict, with its metadata before an
 * observed host runs.
 */
function observePredictedOutputs(probe: {
  base: string;
  config: { compilerOptions: Record<string, unknown> };
  files: readonly string[];
}): Map<string, string> {
  const predict = createOutputPrediction(probe.config, probe.base);
  const outputs = new Map<string, string>();
  for (const source of probe.files)
    for (const output of predict(source))
      outputs.set(output, outputObservation(output));
  return outputs;
}

/**
 * The predicted outputs an observed host wrote: present now, with metadata
 * other than before. A rewrite inside one clock tick at the same size and inode
 * stays invisible, which is why a host that can report its writes must declare
 * `emitProvenance` instead.
 */
function movedOutputs(before: ReadonlyMap<string, string>): string[] {
  const written: string[] = [];
  for (const [output, observation] of before) {
    const after = outputObservation(output);
    if (after !== "missing" && after !== observation) written.push(output);
  }
  return written;
}

/** Device, inode, size and both clocks of one output, or `missing`. */
function outputObservation(file: string): string {
  try {
    const stats = fs.lstatSync(file, { bigint: true });
    return [
      stats.dev,
      stats.ino,
      stats.size,
      stats.mtimeNs,
      stats.ctimeNs,
    ].join(":");
  } catch {
    return "missing";
  }
}

/** The writer's TSFILE report, rather than existing files, establishes writes. */
function writtenJavaScript(stdout: string, cwd: string): string[] {
  const outputs = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    const match = /^TSFILE: +(.+)$/.exec(line);
    if (match && /\.(?:js|jsx|mjs|cjs)$/i.test(match[1]!))
      outputs.add(path.resolve(cwd, match[1]!));
  }
  return [...outputs];
}

/**
 * Source ownership is a physical path; text freshness belongs to cache
 * admission.
 */
function observeSourceIdentity(source: string): string {
  return fs.realpathSync.native(source);
}

/**
 * Resolve sources to physical paths with one native resolution per directory
 * instead of one per file, which cost hundreds of microseconds each and five
 * seconds for one project on Windows (samchon/ttsc#1859).
 *
 * A file that is not itself a link lives at its directory's physical path under
 * its own name, provided that name is the spelling the directory lists: a
 * case-insensitive volume accepts another case, and only the listed spelling is
 * physical. A link, or a name the listing does not hold verbatim, is resolved
 * by itself. Each directory is listed once.
 */
function createSourceIdentity(): (source: string) => string {
  const directories = new Map<
    string,
    { physical: string; names: ReadonlySet<string> }
  >();
  return (source) => {
    if (fs.lstatSync(source).isSymbolicLink())
      return fs.realpathSync.native(source);
    const parent = path.dirname(source);
    let directory = directories.get(parent);
    if (directory === undefined) {
      const physical = fs.realpathSync.native(parent);
      directory = { physical, names: new Set(fs.readdirSync(physical)) };
      directories.set(parent, directory);
    }
    const name = path.basename(source);
    return directory.names.has(name)
      ? path.join(directory.physical, name)
      : fs.realpathSync.native(source);
  };
}
