import { createHash } from "node:crypto";

import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { PassthroughFlags } from "./PassthroughFlags";
import type { RunBuildOptions } from "./RunBuildOptions";
import { appendBuildOutput } from "./appendBuildOutput";
import { createProcessDiagnostic } from "./createProcessDiagnostic";

/**
 * Select and merge the independent diagnostic recovery after a plugin failure.
 * The build engine still owns the native check and report filtering. These
 * supplied results do not establish how either producer acquired its output.
 *
 * @evidence contracts/common.md#principled-implementation Mode exclusions and original failure ownership remain distinct from native execution and report deduplication.
 * @evidence contracts/common.md#clear-and-simple-design One concern groups the recovery gate and final merge used by the actual build engine.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The namespace supplies no executor or synthetic producer and never turns recovery into a successful plugin build.
 * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes policy inputs from producer execution and acquisition.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This grouping performs no native path, filesystem or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Members own policy composition; the namespace selects no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This namespace owns no computed-result cache.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This grouping holds no runtime registry, handle or task.
 */
export namespace PluginFailureDiagnostics {
  /**
   * Permit the independent check unless the selected mode omits diagnostics.
   * Failure admission belongs to the caller; this gate neither changes status
   * nor classifies a successful producer as failed.
   *
   * @evidence contracts/common.md#principled-implementation Exact true format/skip controls and the existing forwarded terminal selector preserve the build engine's recovery exclusions.
   * @evidence contracts/common.md#clear-and-simple-design One predicate owns the mode gate while the caller retains execution and exception ordering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Supplied options use the real terminal flag policy, without a fake compiler or test-only execution callback.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the caller's failure premise and this predicate's diagnostic-mode responsibility.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied option values and forwarded argument semantics are inspected without native paths, filesystem or process calls.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This gate composes scalar checks and the existing terminal selector; argument interpretation belongs to that selector.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Current supplied options are evaluated directly, without caching or cross-call reuse.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This predicate retains no option population, handle or task.
   */
  export function shouldCollect(options: RunBuildOptions): boolean {
    return !(
      options.format === true ||
      options.skipDiagnosticsCheck === true ||
      PassthroughFlags.forwardsTerminalTsgoFlag(options)
    );
  }

  /**
   * Remove this transform invocation's completion token from captured output. A
   * host frames the token and JSON receipt with a leading and trailing newline
   * after reporting its loaded Program's diagnostics, including an empty batch.
   * The receipt must name the actual spawned PID and the requested
   * command/context key; another project checked in-process or a descendant
   * cannot complete it. Bare legacy tokens are consumed without proving
   * completion. Error text cannot establish completion: a host may report a
   * setup error before loading. Tokens from another invocation and tokens
   * embedded in user text survive. The caller supplies a fresh token containing
   * only ASCII letters, digits, colons and hyphens, so it can be matched
   * literally in the line expression. Consume raw capture before diagnostic
   * parsing, so removing a frame restores the producer's original text and
   * continuation boundaries.
   *
   * @evidence contracts/common.md#principled-implementation The fresh token, actual spawned PID and native argument fingerprint must all match; a secondary utility call, descendant report, bare token, parsed error or warning cannot certify the requested Program report.
   * @evidence contracts/common.md#clear-and-simple-design One output adapter consumes the private protocol line and records completion separately from diagnostic content and process status.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No diagnostic code, plugin name or error message substitutes for the host's explicit completion acknowledgement.
   * @evidence contracts/common.md#meaningful-documentation Native prose states complete report delivery, process and command ownership, conservative legacy-token handling and the fresh-token character premise.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied strings are matched with both LF and CRLF line endings without paths, filesystem or process operations.
   * @evidence contracts/performance.md#efficient-algorithms Two linear stream passes remove framed and legacy metadata; framed JSON is decoded by its own bytes. The requested argv/context is fingerprinted at most once for an expected PID; replacements scale with captured output and no diagnostic array is traversed.
   * @evidence contracts/performance.md#reuse-equivalent-work Acknowledged diagnostics from the host's actual Program avoid another compiler run; absent acknowledgement makes no equivalence claim.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Result strings transfer to the caller without a retained registry, handle or task.
   */
  export function consumeHostReport<
    T extends Pick<TtscBuildResult, "stdout" | "stderr">,
  >(
    host: T,
    token: string,
    invocation: {
      pid: number;
      args: readonly string[];
      context?: readonly string[];
    },
  ): Omit<T, "stdout" | "stderr" | "typeScriptDiagnosticsReported"> &
    Pick<
      TtscBuildResult,
      "stdout" | "stderr" | "typeScriptDiagnosticsReported"
    > {
    const line = new RegExp(`\\n${token} ([^\\r\\n]*)(?:\\r?\\n|$)`, "g");
    const legacy = new RegExp(`^${token}(?:\\r?\\n|$)`, "gm");
    let reported = false;
    let command: string | undefined;
    const consume = (_line: string, payload: string | undefined): string => {
      if (payload !== undefined) {
        try {
          const receipt: unknown = JSON.parse(payload);
          if (
            Number.isSafeInteger(invocation.pid) &&
            invocation.pid > 0 &&
            typeof receipt === "object" &&
            receipt !== null &&
            "pid" in receipt &&
            receipt.pid === invocation.pid &&
            "command" in receipt &&
            receipt.command ===
              (command ??= commandKey([
                ...invocation.args,
                ...(invocation.context ?? []),
              ]))
          )
            reported = true;
        } catch {
          // Malformed private metadata cannot suppress diagnostic recovery.
        }
      }
      return "";
    };
    const stdout = host.stdout.replace(line, consume).replace(legacy, "");
    const stderr = host.stderr.replace(line, consume).replace(legacy, "");
    return {
      ...host,
      stdout,
      stderr,
      typeScriptDiagnosticsReported: reported ? true : undefined,
    };
  }

  /**
   * Fingerprint native arguments and owned compiler-channel values with SHA-256
   * over UTF-8 strings, each terminated by a NUL byte. Native arguments and
   * environment values cannot contain NUL, so this framing distinguishes empty
   * values and boundaries without serializing potentially sensitive plugin
   * configuration into the receipt. Callers use the actual dispatched argv
   * followed by the protocol's fixed compiler-channel values; this is not a
   * normalized compiler-options key.
   *
   * @evidence contracts/common.md#principled-implementation NUL-terminated UTF-8 framing is unambiguous for native argv accepted by spawning, and SHA-256 supplies the same command identity as the Go producer under its collision-resistance premise.
   * @evidence contracts/common.md#clear-and-simple-design One fingerprint operation owns receipt command identity beside receipt admission.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The key covers every dispatched argument without recognizing plugins, filenames or selected error codes.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the native NUL-free premise, UTF-8 framing and exact-argv ownership, including why configuration values are not echoed.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied argument strings are encoded as UTF-8 on every host; native spawning owns their executable and path semantics.
   * @evidence contracts/performance.md#efficient-algorithms One incremental hash consumes each argument and delimiter once without constructing a joined argv string; work follows total UTF-8 bytes and retained digest state is fixed-size.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure fingerprint retains no cross-invocation producer or cache; the receipt consumer reuses its one computed key locally.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The call-owned hash is finalized before returning one digest and acquires no native handle or retained registry.
   */
  export function commandKey(args: readonly string[]): string {
    const hash = createHash("sha256");
    for (const arg of args) hash.update(arg, "utf8").update("\0");
    return hash.digest("hex");
  }

  /**
   * Keep the original failure when no new diagnostic batch remains. Otherwise
   * seed its unparsed process failure before the recovered reports and retain
   * its status, even if the independent check returned another status.
   *
   * @evidence contracts/common.md#principled-implementation A null filtered batch preserves failure identity; an empty original diagnostic list receives the shared process diagnostic before phase merging, and the original status replaces the merged status.
   * @evidence contracts/common.md#clear-and-simple-design Seeding, delegated output merge and status restoration form one result adaptation, separate from native execution and filtering.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Reports come from supplied producer results; process seeding exposes the original failure rather than inventing a successful compiler response.
   * @evidence contracts/common.md#meaningful-documentation Native prose distinguishes null-batch identity from seeded merging and states status ownership.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation Supplied result records and text are composed without resolving paths or invoking native filesystem/process APIs.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This adapter delegates record/text/witness merging to appendBuildOutput and message selection to createProcessDiagnostic, without another traversal strategy.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The already filtered batch is consumed once; this adapter owns no producer capture or cross-request cache.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Constructed result records transfer to the caller; this adapter retains no historical population, native handle or task.
   */
  export function append(
    failure: TtscBuildResult,
    fallback: TtscBuildResult | null,
  ): TtscBuildResult {
    if (fallback === null) return failure;
    const seeded =
      failure.diagnostics.length === 0
        ? { ...failure, diagnostics: [createProcessDiagnostic(failure)] }
        : failure;
    const status = failure.status;
    return { ...appendBuildOutput(seeded, fallback), status };
  }
}
