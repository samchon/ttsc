import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { COMPILER_OPTION_KINDS } from "../../../flags/COMPILER_OPTION_KINDS";
import { normalizeFlagToken } from "../../../flags/normalizeFlagToken";
import { resolveFlagSpec } from "../../../flags/resolveFlagSpec";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { ensureExecutable } from "../ensureExecutable";
import { spawnNative } from "../spawnNative";
import { CompilerDiagnostics } from "./CompilerDiagnostics";
import { PassthroughFlags } from "./PassthroughFlags";

/**
 * Observe emitted-source ownership around the selected external compiler. The
 * callback runs the original producer once, with file-list reporting added only
 * when its read-only option and source probes succeeded. Compiler status,
 * diagnostics and user-requested file-list display remain owned by that run.
 *
 * Admission requires stable effective options, identical source selection and
 * stable physical paths, file identities and bytes before and after emission,
 * including the selected executable itself. The executable's change time is
 * excluded from cross-command equality because that metadata changed in real
 * executions without changing the executable object or bytes; source change
 * times remain proof premises and each read brackets its full metadata. This is
 * an external observation, not an atomic compiler-generation ledger; a
 * concurrent change restored between observations can remain invisible.
 * Unsupported layouts and ambiguous outputs carry an empty ownership list.
 *
 * A nonzero compiler status can still carry proved writes for an unchecked
 * consumer. Ownership metadata never changes that status or its diagnostics.
 * Profiling and tracing options suppress probes so their artifacts remain owned
 * by the emitting run.
 *
 * Normally reported ownerless outputs carry their actual failed proof boundary
 * in emittedSourceProofFailures. These explanations preserve compiler streams
 * and status; they do not replace missing ownership with a successful claim.
 *
 * @evidence contracts/common.md#principled-implementation Actual TSFILE writes are matched against the supported upstream per-source extension and explicit-root layout under matching compiler-selected inputs and stable physical/content observations. No emitted filename alone establishes ownership; observation gaps remain documented.
 * @evidence contracts/common.md#clear-and-simple-design One adapter owns read-only compiler probes, the single delegated emission and admission; private helpers isolate option parsing, physical observation and path prediction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The selected executable and original arguments remain authoritative. Unknown layouts are reported unknown instead of switching compilers, guessing same-stem ownership or consulting source maps.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain producer preservation, unknown states and the non-atomic observation limitation; the investigation record documents the supported upstream naming subset.
 * @evidence contracts/portability.md#os-neutral-implementation Native node:path and filesystem realpath/stat separate writer spelling from physical source identity. Executables receive separate argv entries through spawnNative, without a shell or OS-based case folding.
 * @evidence contracts/performance.md#efficient-algorithms Source and output indexes avoid cross-product matching; processing is linear in observed bytes and paths, plus compiler probes and physical filesystem operations.
 * @evidence contracts/performance.md#reuse-equivalent-work Each source observation and predicted output index is shared by all outputs in this invocation. Cross-build reuse is unavailable because arbitrary external producer and filesystem dependencies have no invalidation contract.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Probe processes complete synchronously through spawnNative's capture owner; hashes and indexes live only for this call and scale with selected paths, while transient read buffers scale with the largest observed file, including the executable.
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
  const probe = prepareProbe(options, (reason) => {
    refusal = reason;
  });
  const { result, completedNormally } = options.run(
    probe === undefined
      ? options.args
      : [...options.args, "--listFiles", "true", "--listEmittedFiles", "true"],
  );
  const lines = result.stdout.split(/\r?\n/);
  const sourceLines = new Set(probe?.files);
  const stdout =
    probe === undefined || probe.config.compilerOptions.listFiles === true
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
  const written = writtenJavaScript(result.stdout, options.cwd);
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

  const listed = compilerSourceList(lines, options.cwd);
  const sameSelection = JSON.stringify(listed) === JSON.stringify(probe.files);

  let stable = sameSelection;
  const firstDifference = sameSelection
    ? -1
    : probe.files.findIndex((source, index) => listed[index] !== source);
  let failure = sameSelection
    ? undefined
    : `Emitting source selection differs from its inspection (${probe.files.length} inspected, ${listed.length} reported); first differing inspected path ${JSON.stringify(probe.files[firstDifference])}, reported path ${JSON.stringify(listed[firstDifference === -1 ? probe.files.length : firstDifference])}.`;
  let stage = "effective configuration reinspection";
  try {
    if (stable && readConfig(options)?.text !== probe.text) {
      stable = false;
      failure =
        "Effective configuration changed or could not be reinspected after emission.";
    }
    stage = `executable observation of ${JSON.stringify(probe.binaryPath)}`;
    if (stable) {
      const after = observeFile(probe.binaryPath, "executable");
      if (after !== probe.binaryObservation) {
        stable = false;
        failure = `Selected executable changed across emission: ${JSON.stringify(probe.binaryPath)} (${observationDifference(probe.binaryObservation, after)}).`;
      }
    }
    for (const [source, before] of probe.observations) {
      if (!stable) break;
      stage = `source observation of ${JSON.stringify(source)}`;
      const after = observeFile(source);
      stable = after === before;
      if (!stable)
        failure = `Selected source changed across emission: ${JSON.stringify(source)} (${observationDifference(before, after)}).`;
    }
    if (stable && written.length !== 0) {
      stage = "output prediction";
      const owners = new Map<string, Set<string>>();
      const predictOutputs = createOutputPrediction(probe.config, probe.base);
      let predictedSources = 0;
      let sourceExample: string | undefined;
      for (const source of probe.files) {
        const outputs = predictOutputs(source);
        if (outputs.length === 0) continue;
        predictedSources++;
        sourceExample ??= source;
        const physicalSource: string = JSON.parse(
          probe.observations.get(source)!,
        )[0];
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

/** Append reporting only when it cannot supply a missing trailing option value. */
function prepareProbe(
  options: Parameters<typeof runExternalEmitProvenance>[0],
  onUnavailable: (reason: string) => void,
) {
  let stage = "argument classification";
  const unavailable = (reason: string): undefined => {
    onUnavailable(reason);
    return undefined;
  };
  try {
    const last = options.args.at(-1);
    // A native string option consumes even a following dash token as its value.
    // Appending --showConfig to a missing value can therefore cause emission
    // instead of inspection. Wrapper schema and the compiler-owned arity table
    // together identify booleans; unknown and value-taking options stay unsafe.
    if (last?.startsWith("-")) {
      const kind =
        resolveFlagSpec(last)?.kind ??
        COMPILER_OPTION_KINDS.get(normalizeFlagToken(last.split("=", 1)[0]!));
      if (kind !== "boolean")
        return unavailable(
          `Appending inspection could supply a missing value to the trailing option ${JSON.stringify(last)}.`,
        );
    }
    if (
      PassthroughFlags.forwardsTerminalTsgoFlag({ passthrough: options.args })
    )
      return unavailable(
        "Original argv selects an effective terminal compiler command; provenance inspection would change its command behavior.",
      );
    const unsupportedArg = options.args.find((arg) => {
      const flag = resolveFlagSpec(arg);
      const name = arg.startsWith("-")
        ? normalizeFlagToken(arg.split("=", 1)[0]!)
        : undefined;
      return (
        flag?.name === "--build" ||
        arg.startsWith("@") ||
        name === "pprofdir" ||
        name === "generatecpuprofile" ||
        name === "generatetrace"
      );
    });
    if (unsupportedArg !== undefined)
      return unavailable(
        `Original argv contains ${JSON.stringify(unsupportedArg)}, selecting a build command, response file, or profiling/tracing artifact option unsupported by read-only provenance inspection.`,
      );
    const binaryPath = path.resolve(options.cwd, options.binary);
    stage = `initial executable preparation and observation of ${JSON.stringify(binaryPath)}`;
    // Match spawnNative's native/script boundary before observing ctime: its
    // first POSIX permission preparation must not invalidate our own producer.
    if (!/\.(?:[cm]?js|ts)$/i.test(binaryPath)) ensureExecutable(binaryPath);
    const binaryObservation = observeFile(binaryPath, "executable");
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
        !["preserve", "react", "react-jsx", "react-jsxdev"].includes(
          String(compilerOptions.jsx),
        ))
    )
      return unavailable(
        `Effective configuration selects unsupported provenance layout or reporting: ${JSON.stringify({ references: config.references?.length, outFile: compilerOptions.outFile, rootDir: compilerOptions.rootDir, outDir: compilerOptions.outDir, jsx: compilerOptions.jsx, explainFiles: compilerOptions.explainFiles, generateTrace: compilerOptions.generateTrace, generateCpuProfile: compilerOptions.generateCpuProfile, pprofDir: compilerOptions.pprofDir })}.`,
      );
    stage = "selected configuration anchor";
    const base = projectBase(options.args, options.cwd);
    if (base === undefined)
      return unavailable(
        "Original argv does not establish a supported selected configuration directory.",
      );
    stage = "compiler source-list inspection";
    const listed = spawnNative(
      options.binary,
      [
        ...options.args,
        "--listFilesOnly",
        "true",
        "--listEmittedFiles",
        "false",
      ],
      options,
    );
    if (listed.error || listed.status === null || listed.signal !== null)
      return unavailable(
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
      return unavailable(
        `Source-list inspection returned ${files.length} paths and no complete supported source population; first unsupported candidate: ${JSON.stringify(files.find((file) => !path.isAbsolute(file) || !/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs|json)$/.test(file)))}.`,
      );
    const observations = new Map<string, string>();
    for (const source of files) {
      stage = `initial source observation of ${JSON.stringify(source)}`;
      observations.set(source, observeFile(source));
    }
    return {
      ...parsed,
      base,
      binaryObservation,
      binaryPath,
      files,
      observations,
    };
  } catch (error) {
    return unavailable(
      `Provenance inspection failed during ${stage}: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
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

/** ShowConfig resolves inherited settings and argv overrides in the producer. */
function readConfig(options: Parameters<typeof runExternalEmitProvenance>[0]):
  | {
      config: {
        compilerOptions: Record<string, unknown>;
        references?: unknown[];
      };
      text: string;
    }
  | undefined {
  const result = spawnNative(
    options.binary,
    [...options.args, "--showConfig"],
    options,
  );
  if (result.error || result.status !== 0) return undefined;
  const text = String(result.stdout);
  const config = JSON.parse(text);
  if (
    !config ||
    typeof config !== "object" ||
    !config.compilerOptions ||
    typeof config.compilerOptions !== "object" ||
    Array.isArray(config.compilerOptions) ||
    (config.references !== undefined && !Array.isArray(config.references))
  )
    return undefined;
  return { config, text };
}

/** ShowConfig path options are relative to the selected config's directory. */
function projectBase(args: readonly string[], cwd: string): string | undefined {
  let selected: string | undefined;
  for (let index = 0; index < args.length; index++) {
    if (resolveFlagSpec(args[index]!)?.name !== "--tsconfig") continue;
    if (args[index]!.includes("=")) return undefined;
    selected = args[++index];
    if (selected === undefined || selected.startsWith("-")) return undefined;
  }
  if (selected === undefined) return undefined;
  const project = path.resolve(cwd, selected);
  return fs.statSync(project).isDirectory() ? project : path.dirname(project);
}

/** Bracket full metadata around reads; compare executable bytes and object. */
function observeFile(
  source: string,
  kind: "source" | "executable" = "source",
): string {
  const physical = fs.realpathSync.native(source);
  const before = fs.statSync(source, { bigint: true });
  if (!before.isFile())
    throw new Error("Observed compiler input is not a regular file.");
  const hash = createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex");
  const after = fs.statSync(source, { bigint: true });
  const fullSignature = (stat: fs.BigIntStats) =>
    [stat.dev, stat.ino, stat.size, stat.mtimeNs, stat.ctimeNs].join(":");
  if (
    fullSignature(before) !== fullSignature(after) ||
    fs.realpathSync.native(source) !== physical
  )
    throw new Error("Compiler input changed during observation.");
  const signature =
    kind === "source"
      ? fullSignature(after)
      : [after.dev, after.ino, after.size, after.mtimeNs].join(":");
  return JSON.stringify([physical, signature, hash]);
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
