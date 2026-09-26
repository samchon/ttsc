import path from "node:path";

import type { ITtscCompilerDiagnostic } from "../../../structures/ITtscCompilerDiagnostic";
import type { TtscBuildResult } from "../../../structures/internal/TtscBuildResult";

/**
 * Reading and comparing the compiler diagnostics a build printed.
 *
 * Ttsc receives diagnostics as rendered text from two producers, TypeScript-Go
 * and native plugin hosts, and has to turn that text into structured
 * {@link ITtscCompilerDiagnostic} values and decide when two reports are the
 * same problem. The comparison is what lets a failed plugin run fall back to a
 * plain type-check without printing each TypeScript error twice.
 */
export namespace CompilerDiagnostics {
  /** Return only fallback diagnostics the failed plugin did not already report. */
  export function filterReportedTypeScriptDiagnostics(
    failure: TtscBuildResult,
    typechecked: TtscBuildResult,
    cwd: string,
  ): TtscBuildResult | null {
    if (typechecked.diagnostics.length === 0) {
      return typechecked.status === 0 ? null : typechecked;
    }
    const diagnostics = typechecked.diagnostics.filter(
      (diagnostic) =>
        !failure.diagnostics.some((existing) =>
          compilerDiagnosticsEqual(existing, diagnostic),
        ),
    );
    if (diagnostics.length === 0) return null;
    if (diagnostics.length === typechecked.diagnostics.length)
      return typechecked;
    return {
      ...typechecked,
      diagnostics,
      stderr: filterCompilerDiagnosticText(
        typechecked.stderr,
        diagnostics,
        cwd,
      ),
      stdout: filterCompilerDiagnosticText(
        typechecked.stdout,
        diagnostics,
        cwd,
      ),
    };
  }

  /** Remove diagnostic lines absent from the selected structured result. */
  function filterCompilerDiagnosticText(
    text: string,
    diagnostics: readonly ITtscCompilerDiagnostic[],
    cwd: string,
  ): string {
    const out: string[] = [];
    let keepContinuation = true;
    for (const line of text.split(/\r?\n/)) {
      const plain = stripAnsi(line);
      const diagnostic = parseDiagnosticLine(plain, cwd);
      if (diagnostic !== null) {
        keepContinuation = diagnostics.some((selected) =>
          compilerDiagnosticsEqual(selected, diagnostic),
        );
        if (keepContinuation) out.push(line);
        continue;
      }
      if (/^Found\s+\d+\s+errors?/i.test(plain)) continue;
      if (!keepContinuation && /^\s+/.test(line)) continue;
      keepContinuation = true;
      out.push(line);
    }
    return out.join("\n");
  }

  /** Compare normalized compiler diagnostics before appending fallback output. */
  function compilerDiagnosticsEqual(
    left: ITtscCompilerDiagnostic,
    right: ITtscCompilerDiagnostic,
  ): boolean {
    return (
      left.category === right.category &&
      left.code === right.code &&
      left.file === right.file &&
      diagnosticPositionsEqual(left, right) &&
      diagnosticHeadline(left.messageText) ===
        diagnosticHeadline(right.messageText)
    );
  }

  /** Compare offsets when available, otherwise compare rendered line/column. */
  function diagnosticPositionsEqual(
    left: ITtscCompilerDiagnostic,
    right: ITtscCompilerDiagnostic,
  ): boolean {
    if (left.start !== undefined && right.start !== undefined) {
      return left.start === right.start;
    }
    return left.line === right.line && left.character === right.character;
  }

  /** Remove pretty-rendered source context from a diagnostic message. */
  function diagnosticHeadline(message: string): string {
    return message.split(/\r?\n/, 1)[0]!.trim();
  }

  /**
   * Try to parse a single line as a TypeScript compiler diagnostic in one of
   * three formats:
   *
   * - `file:line:col - category TSxxxx: message` (colon-separated, tsgo style)
   * - `file(line,col): category TSxxxx: message` (paren style, classic tsc)
   * - `category TSxxxx: message` (global, no file)
   *
   * Returns `null` when the line does not match any format.
   */
  export function parseDiagnosticLine(
    line: string,
    cwd: string | undefined,
  ): ITtscCompilerDiagnostic | null {
    const colonMatch = line.match(
      /^(.+):(\d+):(\d+)\s+-\s+(error|warning|suggestion|message)\s+(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
    );
    if (colonMatch) {
      return {
        category: normalizeDiagnosticCategory(colonMatch[4]!),
        character: Number(colonMatch[3]),
        code: normalizeDiagnosticCode(colonMatch[5]!),
        file: normalizeDiagnosticFile(colonMatch[1]!, cwd),
        line: Number(colonMatch[2]),
        messageText: colonMatch[6]!,
      };
    }

    const fileMatch = line.match(
      /^(.+?)\((\d+),(\d+)\):\s+(error|warning|suggestion|message)\s+(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
    );
    if (fileMatch) {
      return {
        category: normalizeDiagnosticCategory(fileMatch[4]!),
        character: Number(fileMatch[3]),
        code: normalizeDiagnosticCode(fileMatch[5]!),
        file: normalizeDiagnosticFile(fileMatch[1]!, cwd),
        line: Number(fileMatch[2]),
        messageText: fileMatch[6]!,
      };
    }

    const globalMatch = line.match(
      /^(error|warning|suggestion|message)\s+(\d+|[A-Z][A-Z0-9_-]*):\s+(.+)$/i,
    );
    if (!globalMatch) {
      return null;
    }
    return {
      category: normalizeDiagnosticCategory(globalMatch[1]!),
      code: normalizeDiagnosticCode(globalMatch[2]!),
      file: null,
      messageText: globalMatch[3]!,
    };
  }

  /**
   * Return an absolute file path. When `file` is already absolute it is
   * returned unchanged; relative paths are resolved against `cwd` when
   * available.
   */
  function normalizeDiagnosticFile(
    file: string,
    cwd: string | undefined,
  ): string {
    if (path.isAbsolute(file) || cwd === undefined) {
      return file;
    }
    return path.resolve(cwd, file);
  }

  /**
   * Map a raw category string (`"error"`, `"warning"`, `"suggestion"`,
   * `"message"`) to the canonical `ITtscCompilerDiagnostic.Category`. Any
   * unrecognised value is coerced to `"error"`.
   */
  function normalizeDiagnosticCategory(
    value: string,
  ): ITtscCompilerDiagnostic.Category {
    const lowered = value.toLowerCase();
    return lowered === "warning" ||
      lowered === "suggestion" ||
      lowered === "message"
      ? lowered
      : "error";
  }

  /**
   * Parse a diagnostic code as a number when it is TypeScript's own spelling
   * (`TS2322`, or bare digits), or keep the whole token as a string for a
   * plugin-defined code. Only the `TS` prefix is TypeScript's; stripping any
   * other letters would turn a plugin's `FOO123` into TypeScript's `123`.
   */
  function normalizeDiagnosticCode(value: string): number | string {
    const numeric = /^(?:TS)?(\d+)$/i.exec(value);
    return numeric === null ? value : Number(numeric[1]);
  }

  /**
   * Strip ANSI escape sequences from `text` for line-by-line diagnostic
   * parsing.
   */
  export function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
  }
}
