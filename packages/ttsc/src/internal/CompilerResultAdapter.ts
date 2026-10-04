import { createProcessDiagnostic } from "../compiler/internal/build/createProcessDiagnostic";
import type { ITtscCompilerDiagnostic } from "../structures/ITtscCompilerDiagnostic";
import type { ITtscCompilerResult } from "../structures/ITtscCompilerResult";
import type { ITtscCompilerTransformation } from "../structures/ITtscCompilerTransformation";
import type { TtscBuildResult } from "../structures/internal/TtscBuildResult";
import { serializeCompilerError } from "./serializeCompilerError";
/** The compile producer's actual output and build outcome, before API adaptation.
 * @evidence contracts/common.md#principled-implementation This input retains output and build outcome as separate producer-owned values.
 * @evidence contracts/common.md#clear-and-simple-design Two named fields carry the existing compile adapter boundary without a second output representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type does not supply native output or certify an authored record as a compiler product.
 * @evidence contracts/common.md#meaningful-documentation The native sentence distinguishes the producer boundary from API result adaptation.
 */
interface ProjectResult {
  output: Record<string, string>;
  result: TtscBuildResult;
}

/** The transform producer's source records and optional advisory observations.
 * @evidence contracts/common.md#principled-implementation Optional fields retain the producer's absent-versus-present observations independently of build status.
 * @evidence contracts/common.md#clear-and-simple-design One input shape carries source, build and advisory values to the same result adapter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The representation does not invent host reads, graph membership or compiler completeness.
 * @evidence contracts/common.md#meaningful-documentation The native sentence identifies the actual producer-owned fields and optionality.
 */
interface ProjectTransformation {
  dependencies?: Record<string, string[]>;
  dependenciesComplete?: string[];
  graph?: ITtscCompilerTransformation.IReferenceGraph;
  hostInputHashes?: Record<string, string | null>;
  hostInputProofFailures?: Record<string, "observation-unavailable">;
  hostInputRealpaths?: Record<string, string | null>;
  hostInputs?: string[];
  observationsComplete?: false;
  pluginSources?: Record<string, string>;
  result: TtscBuildResult;
  sourceMaps?: Record<string, ITtscCompilerTransformation.ISourceMap>;
  typescript: Record<string, string>;
  volatile?: string[];
}

/** Run the selected compile task once and adapt its returned or thrown outcome.
 * @evidence contracts/common.md#principled-implementation The original task runs once; its output/status/diagnostics or thrown error determine the public result kind.
 * @evidence contracts/common.md#clear-and-simple-design One try/catch joins the task owner with the existing compile and exception adapters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No native task, output or error is substituted; caught values retain the existing serialization and classification policy.
 * @evidence contracts/common.md#meaningful-documentation The native sentence states exact invocation and returned/thrown ownership.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The task owner chooses native files/processes; this boundary chooses only result adaptation and no independent platform policy.
 * @evidence contracts/performance.md#efficient-algorithms Cost includes the arbitrary selected task, diagnostic scan and any process-diagnostic construction or error serialization/classification; the fixed envelope does not bound those costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adapter coordinates no reusable native producer or cached outcome.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned producer references transfer to the caller; task resources and their lifetime remain with the task owner.
 */
export function runProject(task: () => ProjectResult): ITtscCompilerResult {
  try {
    return toCompilerResult(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

/** Run the selected transform task once, preserving its optional observations.
 * @evidence contracts/common.md#principled-implementation Successful and failed build outcomes retain source/advisory values while thrown outcomes use the existing exception policy.
 * @evidence contracts/common.md#clear-and-simple-design One try/catch invokes the selected task and delegates to the transform result adapter.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter neither reconstructs native observations nor replaces the actual task with a result certificate.
 * @evidence contracts/common.md#meaningful-documentation The native sentence distinguishes selected execution from its observation adaptation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The task owns its native platform boundaries; this function selects no path, process or filesystem policy.
 * @evidence contracts/performance.md#efficient-algorithms The task cost is delegated in full, followed by diagnostic scanning, fixed optional-field projection and exceptional serialization/classification when needed.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No completed or in-flight transform is cached by this adapter.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned source/advisory references remain caller-owned; the task owns native resource acquisition and retirement.
 */
export function runTransformation(
  task: () => ProjectTransformation,
): ITtscCompilerTransformation {
  try {
    return toCompilerTransformation(task());
  } catch (error) {
    return {
      error: normalizeError(error),
      kind: classifyException(error),
      type: "exception",
    };
  }
}

/**
 * Best-effort classifier for the `kind` field of `IException`. Pattern- matches
 * the real prefixes thrown inside this package:
 *
 * - Plugin: messages from `loadProjectPlugins.ts` / `buildSourcePlugin.ts` start
 *   with `ttsc: plugin "..."` or `ttsc: package "..." declares ...`, and
 *   transform-time spawn failures start with `ttsc.transform:` /
 *   `ttsc.transform.check:`. The Go-toolchain missing envelope also surfaces
 *   here.
 * - Host: everything else under the `ttsc:` umbrella — the bare `ttsc:` strings
 *   from `packageRootDir.ts`, `ttsc: TypeScript-Go executable not found`
 *   (`resolveTsgo.ts`), `ttsc: failed to spawn native compiler host`
 *   (`transformProjectInMemory.ts`), and tsconfig / extended-tsconfig shapes
 *   from `readProjectConfig.ts`.
 * - Anything else falls back to `"unknown"` so embedders always see the field set
 *   per the documented contract.
 *
 * Order matters: plugin patterns must run before the generic `ttsc:` test
 * because every plugin message also starts with `ttsc:`.
 */
/** Classify the observed message using the existing plugin-before-host patterns.
 * @evidence contracts/common.md#principled-implementation Original plugin-prefix precedence and host fallback are retained; unreadable message inspection yields unknown.
 * @evidence contracts/common.md#clear-and-simple-design One guarded message extraction precedes the two existing pattern groups.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Classification is best-effort message policy, not a certificate of exception origin or native process ownership.
 * @evidence contracts/common.md#meaningful-documentation The adjacent native paragraphs describe actual prefix shapes, ordering and unknown fallback.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Message matching inspects no filesystem, executable or native platform capability.
 * @evidence contracts/performance.md#efficient-algorithms Message inspection can invoke existing Error property behavior; pattern work visits selected message text and extraction failures return unknown. Message size is not bounded here.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Classification coordinates no reusable operation or outcome cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the returned kind is retained by callers; this operation acquires no resource or registry.
 */
export function classifyException(error: unknown): "plugin" | "host" | "unknown" {
  let message: string;
  try {
    const description =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : error !== null && typeof error === "object"
            ? Object.getOwnPropertyDescriptor(error, "message")?.value
            : undefined;
    message = typeof description === "string" ? description : "";
  } catch {
    return "unknown";
  }
  if (
    // Match every plugin-origin shape with verb-anchored patterns so a
    // host-path containing the literal token `plugin` (e.g.
    // `TTSC_BINARY=/opt/cache/plugins/ttsc-bin`) does not misclassify
    // as kind="plugin". Each alternative anchors at the start of the
    // message to capture the verb, not anywhere later in the line:
    //
    //   - `ttsc: plugin "..."` / `ttsc: package "..."` — from
    //     loadProjectPlugins.ts
    //   - `ttsc: building plugin "..."` / `ttsc: reading go.mod for
    //     plugin "..."` — from buildSourcePlugin.ts
    //   - `ttsc.transform:` / `ttsc.transform.check:` — from
    //     transformProjectInMemory.ts
    //   - `ttsc-plugin:` — legacy prefix kept for compatibility
    //   - `go toolchain` — the goToolchainNotFoundMessage envelope
    /^ttsc:\s*plugin\b|^ttsc:\s*package\b|^ttsc:\s*building plugin\b|^ttsc:\s*reading go\.mod for plugin\b|^ttsc\.transform[.:]|^ttsc-plugin:|go toolchain/i.test(
      message,
    )
  ) {
    return "plugin";
  }
  if (
    /^ttsc:|tsconfig|extended tsconfig|TypeScript-Go|native compiler host/i.test(
      message,
    )
  ) {
    return "host";
  }
  return "unknown";
}

/** Adapt a compile producer outcome, preserving its output record reference.
 * @evidence contracts/common.md#principled-implementation Status zero without error diagnostics succeeds; every other result fails and an empty diagnostic list receives the original process diagnostic.
 * @evidence contracts/common.md#clear-and-simple-design One status/diagnostic guard constructs success or failure while preserving output identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Warning diagnostics are not converted to errors and nonzero process outcomes are not promoted to success.
 * @evidence contracts/common.md#meaningful-documentation The native sentence identifies output-reference preservation rather than copied or certified output.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This is result-data policy; the process diagnostic owner formats already reported outcome values.
 * @evidence contracts/performance.md#efficient-algorithms Diagnostic classification scans until an error; otherwise a fixed envelope retains output/diagnostic references, with delegated process-diagnostic text work on empty failures.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work No producer or previous result is reused by this adapter.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Output/diagnostic references transfer through the return value and no independent cache or resource is acquired.
 */
function toCompilerResult(project: ProjectResult): ITtscCompilerResult {
  const { output, result } = project;
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      output,
      type: "success",
    };
  }
  return {
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    output,
    type: "failure",
  };
}

/** Adapt source/build outcome and copy optional advisory references only when present.
 * @evidence contracts/common.md#principled-implementation Undefined advisory fields are omitted; present empty/false values and references survive both success and failure, alongside the existing diagnostic decision.
 * @evidence contracts/common.md#clear-and-simple-design One optional-field projection is shared by the two result branches.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The adapter does not manufacture graph, host-read or completeness proof and does not discard it solely because the build failed.
 * @evidence contracts/common.md#meaningful-documentation The native sentence states omission policy and reference ownership.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Advisory values are passed through without native path normalization or capability inference.
 * @evidence contracts/performance.md#efficient-algorithms Fixed optional-field checks retain references without scanning map text; diagnostic classification and empty-failure formatting have their delegated data costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This adaptation coordinates no reusable compiler/worker or outcome cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned source/advisory objects remain reachable under caller ownership; this operation owns no process, lease or historical registry.
 */
export function toCompilerTransformation(
  project: ProjectTransformation,
): ITtscCompilerTransformation {
  const {
    dependencies,
    dependenciesComplete,
    graph,
    hostInputHashes,
    hostInputProofFailures,
    hostInputRealpaths,
    hostInputs,
    observationsComplete,
    pluginSources,
    result,
    sourceMaps,
    typescript,
    volatile,
  } = project;
  const advisoryFields = {
    ...(dependencies === undefined ? {} : { dependencies }),
    ...(dependenciesComplete === undefined ? {} : { dependenciesComplete }),
    ...(graph === undefined ? {} : { graph }),
    ...(hostInputHashes === undefined ? {} : { hostInputHashes }),
    ...(hostInputProofFailures === undefined ? {} : { hostInputProofFailures }),
    ...(hostInputRealpaths === undefined ? {} : { hostInputRealpaths }),
    ...(hostInputs === undefined ? {} : { hostInputs }),
    ...(observationsComplete === undefined ? {} : { observationsComplete }),
    ...(pluginSources === undefined ? {} : { pluginSources }),
    ...(sourceMaps === undefined ? {} : { sourceMaps }),
    ...(volatile === undefined ? {} : { volatile }),
  };
  if (result.status === 0 && !hasErrorDiagnostics(result.diagnostics)) {
    return {
      ...(result.diagnostics.length === 0
        ? {}
        : { diagnostics: result.diagnostics }),
      ...advisoryFields,
      type: "success",
      typescript,
    };
  }
  return {
    ...advisoryFields,
    diagnostics:
      result.diagnostics.length === 0
        ? [createProcessDiagnostic(result)]
        : result.diagnostics,
    type: "failure",
    typescript,
  };
}

/** Report whether the supplied diagnostics contain an error category.
 * @evidence contracts/common.md#principled-implementation Only the literal error category changes this outcome; other diagnostic categories remain advisory.
 * @evidence contracts/common.md#clear-and-simple-design A short-circuiting predicate expresses the existing success guard directly.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Status and message text are not guessed as substitutes for diagnostic category.
 * @evidence contracts/common.md#meaningful-documentation The native sentence identifies the supplied diagnostic population and category decision.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation Category comparison accesses no native platform boundary.
 * @evidence contracts/performance.md#efficient-algorithms The scan visits at most the supplied diagnostic count and stops at the first error.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This predicate coordinates no cached or in-flight result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A boolean is returned without retaining diagnostic history or acquiring a resource.
 */
function hasErrorDiagnostics(
  diagnostics: readonly ITtscCompilerDiagnostic[],
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.category === "error");
}

/** Serialize the actual thrown value through the existing compiler error owner.
 * @evidence contracts/common.md#principled-implementation The original serializer receives the exact thrown value rather than a guessed error message.
 * @evidence contracts/common.md#clear-and-simple-design One delegation shares the compiler error representation with synchronous and worker result adapters.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Serialization does not manufacture a native exception or replace the task that threw it.
 * @evidence contracts/common.md#meaningful-documentation The native sentence names the actual value and owning serializer.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The error representation owner inspects data rather than native platform capability.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The existing serializer owns value traversal, reference tracking and encoded allocation; this adapter adds no independent serialization algorithm or size bound.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This call coordinates no reusable producer or previous serialized result.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Returned serialized data transfers to the caller; traversal state and exceptional value inspection remain with the serializer owner.
 */
export function normalizeError(error: unknown): unknown {
  return serializeCompilerError(error);
}
