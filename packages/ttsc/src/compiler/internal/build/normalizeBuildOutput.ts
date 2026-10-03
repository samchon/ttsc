import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { CompilerDiagnostics } from "./CompilerDiagnostics";

/**
 * Normalise a raw spawn result into a `TtscBuildResult`.
 *
 * When `diagnostics` is absent they are parsed from the text output. When the
 * process exited non-zero but stderr is empty and stdout is non-empty, stdout
 * is moved to stderr so the error is visible to callers who only check stderr.
 * All other result metadata, including emit provenance, is preserved.
 *
 * @evidence contracts/common.md#principled-implementation Explicit diagnostics take precedence over text parsing; failure-output relocation preserves status and emit-provenance metadata while making captured error text visible.
 * @evidence contracts/common.md#clear-and-simple-design Output normalization and optional parsing share one entry point; a private parser owns summary skipping and indented message continuation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Parsed compiler formats and actual process status determine results; unmatched text is not fabricated into a successful diagnostic record.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains absent diagnostics and the failure-output relocation; the private parser explains continuation and summary handling.
 * @evidence contracts/portability.md#os-neutral-implementation Diagnostic filenames use the native path normalizer with optional compiler cwd; CRLF and LF output are both recognized without case-policy guesses.
 * @evidence contracts/performance.md#efficient-algorithms Absent diagnostics require ANSI stripping and line splitting followed by format matches on each line. Continuation chunks are joined once per diagnostic instead of repeatedly concatenating a growing message; temporary lines, chunks and records scale with captured output. Supplied arrays bypass this work.
 * @evidence contracts/performance.md#reuse-equivalent-work Preparsed diagnostics are reused directly instead of reconstructing the same records from stdout and stderr.
 *
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This adapter returns data without owning a process, persistent cache or retained history.
 */
export function normalizeBuildOutput(
  result: PartialBuildResult,
  cwd?: string,
): TtscBuildResult {
  const diagnostics =
    result.diagnostics ?? parseCompilerDiagnostics(result, cwd);
  if (result.status === 0 || result.stderr.trim().length !== 0) {
    return { ...result, diagnostics };
  }
  if (result.stdout.trim().length === 0) {
    return { ...result, diagnostics };
  }
  return {
    ...result,
    diagnostics,
    stdout: "",
    stderr: result.stdout,
  };
}

/**
 * `TtscBuildResult` with `diagnostics` made optional. Used internally when
 * diagnostics are parsed lazily from stdout/stderr by `normalizeBuildOutput`.
 */
type PartialBuildResult = Omit<TtscBuildResult, "diagnostics"> & {
  diagnostics?: ITtscCompilerDiagnostic[];
};

/**
 * Parse structured diagnostics from the combined stderr+stdout text when the
 * caller did not supply pre-parsed diagnostics. ANSI escape codes are stripped
 * and `TSFILE:` / `Found N errors` summary lines are skipped.
 */
function parseCompilerDiagnostics(
  result: Pick<TtscBuildResult, "stderr" | "stdout">,
  cwd: string | undefined,
): ITtscCompilerDiagnostic[] {
  const lines = CompilerDiagnostics.stripAnsi(
    `${result.stderr}\n${result.stdout}`,
  ).split(/\r?\n/);
  const out: ITtscCompilerDiagnostic[] = [];
  let current: ITtscCompilerDiagnostic | undefined;
  let messageChunks: string[] = [];
  for (const line of lines) {
    if (line.length === 0 || /^TSFILE:\s*/.test(line)) {
      continue;
    }
    if (/^Found\s+\d+\s+errors?/i.test(line)) {
      continue;
    }

    const diagnostic = CompilerDiagnostics.parseDiagnosticLine(line, cwd);
    if (diagnostic !== null) {
      if (current !== undefined)
        current.messageText = messageChunks.join("\n");
      current = diagnostic;
      messageChunks = [diagnostic.messageText];
      out.push(current);
      continue;
    }

    if (current !== undefined && /^\s+/.test(line)) {
      messageChunks.push(line.trimEnd());
    }
  }
  if (current !== undefined) current.messageText = messageChunks.join("\n");
  return out;
}
