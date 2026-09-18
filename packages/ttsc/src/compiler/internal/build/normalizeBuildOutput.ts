import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";
import { CompilerDiagnostics } from "./CompilerDiagnostics";

/**
 * Normalise a raw spawn result into a `TtscBuildResult`.
 *
 * When `diagnostics` is absent they are parsed from the text output. When the
 * process exited non-zero but stderr is empty and stdout is non-empty, stdout
 * is moved to stderr so the error is visible to callers who only check stderr.
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
    diagnostics,
    emittedFiles: result.emittedFiles,
    status: result.status,
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
  const lines = CompilerDiagnostics.stripAnsi(`${result.stderr}\n${result.stdout}`).split(/\r?\n/);
  const out: ITtscCompilerDiagnostic[] = [];
  let current: ITtscCompilerDiagnostic | undefined;
  for (const line of lines) {
    if (line.length === 0 || /^TSFILE:\s*/.test(line)) {
      continue;
    }
    if (/^Found\s+\d+\s+errors?/i.test(line)) {
      continue;
    }

    const diagnostic = CompilerDiagnostics.parseDiagnosticLine(line, cwd);
    if (diagnostic !== null) {
      current = diagnostic;
      out.push(current);
      continue;
    }

    if (current !== undefined && /^\s+/.test(line)) {
      current.messageText += `\n${line.trimEnd()}`;
    }
  }
  return out;
}
