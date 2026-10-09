import path from "node:path";

import { readCompilerOptionValues } from "../../../flags/readCompilerOptionValues";
import type { ITtscParsedProjectConfig } from "../../../structures/internal/ITtscParsedProjectConfig";
import type { TtscCommonOptions } from "../../../structures/internal/TtscCommonOptions";
import { CompilerArgumentsInspection } from "../CompilerArgumentsInspection";
import { readProjectConfig } from "./readProjectConfig";
import { resolveProjectIdentity } from "./resolveProjectIdentity";

/**
 * Share compiler project authority, original argument anchoring and freshness.
 *
 * @evidence contracts/common.md#principled-implementation Members separate observed selection, publication freshness and safe phase guards while native APIs retain compiler validation.
 * @evidence contracts/common.md#clear-and-simple-design One internal identity groups the shared invocation concern; members own their independent boundaries.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No global state, compiler parser replacement or foreign API mutation is introduced.
 * @evidence contracts/common.md#meaningful-documentation Each member documents its selection, lifetime and native diagnostic limits.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The grouping has no separate native boundary; member operations own native input handling.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The grouping contains no independent algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Members own invocation reuse rather than namespace history.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no state or handles.
 */
export namespace CompilerProjectSelection {
  /**
   * Resolve one compiler project without rebasing its original argument frame.
   *
   * Validated visible selectors retain their positions beside original response
   * tokens. The existing observed inspector projects those frames for selection;
   * the native producer still receives their original bytes and owns validation.
   * Positional discovery starts at the supplied file until an observed project
   * assignment selects another config. Explicit resolvedProject callers retain
   * their independent API authority.
   * Observations are sequential and do not pin bytes across a later producer.
   *
   * @evidence contracts/common.md#principled-implementation Existing schema occurrence metadata and observed response inspection establish ordered canonical project assignments; one selected config is returned separately from the retained compiler argument cwd.
   * @evidence contracts/common.md#clear-and-simple-design One invocation record carries project, original transport, inspection projection and response observations to build and watch consumers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing compiler metadata and response inspection are reused without a new tokenizer, compiler option parser, path-option rewrite or upstream modification. Explicit resolvedProject remains authoritative.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains order, separate argument anchoring, explicit API authority and non-atomic observation limits.
   * @evidence contracts/portability.md#os-neutral-implementation Native path resolution and existing project identity preserve physical config/root spelling; visible operands use invocation cwd while response operands retain compiler cwd.
   * @evidence contracts/performance.md#efficient-algorithms One ordered merge visits forwarded tokens and visible selectors, followed by one existing projection or response inspection and selected config resolution. Cost includes response bytes and inherited config work; no historical cache is introduced.
   * @evidence contracts/performance.md#reuse-equivalent-work The returned invocation view shares current inspection and project selection across consumers; a new selection rereads response/config state.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous reads acquire no retained handles. Returned arguments, config and observations belong to the invocation and scale with its expanded inputs.
   */
  export function read(
    options: TtscCommonOptions & {
      file?: string;
      files?: readonly string[];
      tsconfig?: string;
      resolvedProject?: ITtscParsedProjectConfig;
    },
  ) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const file = options.file ??
      (options.files?.length === 1 ? options.files[0] : undefined);
    let initial = options.resolvedProject?.identity;
    let initialError: unknown;
    if (initial === undefined) {
      try {
        initial = resolveProjectIdentity({ ...options, file });
      } catch (error) {
        // An earlier locator is not necessarily the native-selected project.
        // With no resolved anchor, preserve invocation cwd rather than guessing
        // whether a missing path denotes a file or a directory. Its original
        // failure remains authoritative when no later selector supersedes it.
        initialError = error;
      }
    }
    const compilerArgsCwd = path.resolve(
      options.compilerArgsCwd ?? initial?.physicalProjectRoot ?? cwd,
    );
    const passthrough = options.passthrough ?? [];
    const responseFrames = readCompilerOptionValues(passthrough).responseFiles;
    const selections =
      responseFrames.length === 0
        ? []
        : (options.compilerProjectSelections ?? []);
    const args: string[] = [];
    let cursor = 0;
    for (let index = 0; index <= passthrough.length; index++) {
      while (selections[cursor]?.passthroughIndex === index) {
        const value = selections[cursor]!.value;
        args.push("--project", value === "" ? "" : path.resolve(cwd, value));
        cursor++;
      }
      if (index !== passthrough.length) args.push(passthrough[index]!);
    }
    let inspected = { args, observations: new Map<string, string>() };
    let inspectionError: unknown;
    if (responseFrames.length !== 0) {
      try {
        inspected = CompilerArgumentsInspection.inspect(args, compilerArgsCwd);
      } catch (error) {
        // An unavailable inspection cannot establish another project. Preserve
        // the original producer frame, without a final selection/reporting flag.
        inspectionError = error;
      }
    }
    const assignments =
      inspectionError === undefined
        ? readCompilerOptionValues(inspected.args).values
        : new Map<string, unknown>();
    const selected = assignments.get("project");
    if (!assignments.has("project") && initialError !== undefined)
      throw initialError;
    const project =
      options.resolvedProject ??
      readProjectConfig({
        cwd: assignments.has("project") ? compilerArgsCwd : cwd,
        file: assignments.has("project") ? undefined : file,
        projectRoot: options.projectRoot,
        tsconfig: assignments.has("project")
          ? typeof selected === "string"
            ? selected
            : undefined
          : options.tsconfig,
      });
    let projectGuard: readonly string[] = [];
    if (responseFrames.length !== 0 && inspectionError === undefined) {
      projectGuard = ["-p", project.path];
    } else if (
      options.resolvedProject !== undefined && assignments.has("project")
    ) {
      // A reporting/selection guard must not become a missing top-level scalar
      // operand. An unsafe native request retains its original diagnostic frame.
      try {
        CompilerArgumentsInspection.inspect(args, compilerArgsCwd);
        projectGuard = ["-p", project.path];
      } catch {
        // The original producer diagnoses this unsafe request without a guard.
      }
    }
    return {
      args,
      passthrough: [...passthrough],
      compilerArgsCwd,
      inspectionError,
      inspectedArgs: inspected.args,
      observations: inspected.observations,
      project,
      projectGuard,
    };
  }

  /**
   * Reject a changed response generation before a consumer publishes or runs it.
   * This is a sequential reobservation, not an atomic producer snapshot.
   *
   * @evidence contracts/common.md#principled-implementation Current physical/content observations must match every response input admitted by this selection before its consumer proceeds.
   * @evidence contracts/common.md#clear-and-simple-design One loop delegates actual file observation to the existing owner and propagates read failures.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A mismatch rejects stale authority rather than silently recomputing only one consumer or certifying an atomic filesystem snapshot.
   * @evidence contracts/common.md#meaningful-documentation Native prose states generation rejection and the sequential observation limitation.
   * @evidence contracts/portability.md#os-neutral-implementation Existing native physical identity and content observations supply equality without path-case or platform guesses.
   * @evidence contracts/performance.md#efficient-algorithms One observation per distinct response input rereads/hashes its bytes and native metadata; cost follows the admitted population and byte volume.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work A current filesystem observation cannot reuse a historical signature as proof of freshness.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Synchronous observation retains no handle or history; the selection belongs to its caller.
   */
  export function assertCurrent(
    selection: Pick<
      ReturnType<typeof read>,
      "observations"
    >,
  ): void {
    for (const [file, observation] of selection.observations)
      if (CompilerArgumentsInspection.observeInputFile(file) !== observation)
        throw new Error(
          `Compiler response file changed after project selection: ${file}`,
        );
  }

  /**
   * Pin an established project only after the current forwarded frame is safe.
   * A phase may filter or extend argv after context acquisition; it must retain
   * that live payload without letting a final flag satisfy an incomplete scalar.
   *
   * @evidence contracts/common.md#principled-implementation An unchanged observed frame reuses its admitted guard; changed phase arguments receive the existing conservative inspection before the selected project can be pinned.
   * @evidence contracts/common.md#clear-and-simple-design One guard reader preserves live argv and the context's selected project without duplicating option arity or response grammar.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsafe frames receive no added project operand and retain native validation; response bytes are reobserved instead of assuming a changed phase still matches acquisition.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the phase mutation and missing-scalar premise.
   * @evidence contracts/portability.md#os-neutral-implementation The existing observed inspector owns native response identity and decoding; selected native paths are returned without slash or case rewriting.
   * @evidence contracts/performance.md#efficient-algorithms A length and token comparison costs current argv text; changed guarded frames add existing response expansion and hashing work proportional to expanded bytes.
   * @evidence contracts/performance.md#reuse-equivalent-work Exact unchanged argv reuses the current selection guard; a different phase frame is inspected independently rather than borrowing its safety proof.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The operation retains no phase history or handles; returned guards remain selection-owned.
   */
  export function readGuard(
    selection: ReturnType<typeof read>,
    passthrough: readonly string[] = [],
  ): readonly string[] {
    if (selection.projectGuard.length === 0) return [];
    if (
      passthrough.length === selection.passthrough.length &&
      passthrough.every((arg, index) => arg === selection.passthrough[index])
    )
      return selection.projectGuard;
    try {
      const inspected = CompilerArgumentsInspection.inspect(
        passthrough,
        selection.compilerArgsCwd,
      );
      assertCurrent(inspected);
      return selection.projectGuard;
    } catch {
      return [];
    }
  }
}
