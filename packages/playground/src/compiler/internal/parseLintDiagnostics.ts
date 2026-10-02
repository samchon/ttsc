import type { ICompilerService } from "../../structures/ICompilerService";

// Match `file:line:col - severity TS<code>: [rule-name] message` lines from
// tsgo's pretty diagnostic renderer. ANSI color escapes are stripped first
// so the matcher works on the exact text rendered in the Lint tab.
const LINT_LINE_REGEXP =
  /([^\s:]+):(\d+):(\d+)\s+-\s+(error|warning)\s+TS(\d+):\s+(?:\[([^\]]+)\]\s+)?(.*)$/;
// Strip real ANSI SGR sequences, which always start with ESC (0x1b). The
// leading ESC byte is required — `/\[[0-9;]*m/g` would also chew innocuous
// substrings like "[m" or "[0;1m" inside diagnostic messages, and would
// fail to actually strip the ESC bytes tsgo writes, leaving the
// LINT_LINE_REGEXP unable to anchor on the filename column.
const ANSI_REGEXP = /\x1b\[[0-9;]*m/g;

/**
 * Parse the lint plugin's stderr (tsgo-style pretty diagnostics) into the
 * playground's normalized diagnostic shape.
 *
 * @evidence contracts/common.md#principled-implementation The parser recognizes the supported pretty-diagnostic grammar after removing actual ANSI SGR escapes and carries its one-based line and column unchanged into UI records.
 * @evidence contracts/common.md#clear-and-simple-design Matching and record construction stay in one pass; token-span inference remains a local helper rather than a second diagnostic protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown lines are omitted as non-diagnostics; the owning pipeline separately reports plugin failure instead of treating every empty parse as success.
 * @evidence contracts/common.md#meaningful-documentation Native prose identifies producer format and normalization responsibility; nearby comments explain ANSI matching reasons under the documentation skill.
 * @evidence contracts/performance.md#efficient-algorithms Stderr normalization and source-line indexing each occur once per parse; each matched finding inspects only its referenced source line, avoiding a complete source split for every diagnostic. Temporary arrays grow with stderr lines, source lines and findings.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation parses one completed output and does not coordinate sharing across lint requests; per-parse line indexing is part of its algorithm.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Line indexes are local temporaries and findings transfer to the caller; no retained cache or native handle is owned here.
 */
export function parseLintDiagnostics(
  stderr: string,
  source: string,
): ICompilerService.IDiagnostic[] {
  const stripped = stderr.replace(ANSI_REGEXP, "");
  const lines = stripped.split(/\r?\n/);
  const sourceLines = source.split(/\r?\n/);
  const out: ICompilerService.IDiagnostic[] = [];
  for (const line of lines) {
    const m = line.match(LINT_LINE_REGEXP);
    if (!m) continue;
    const [, , lineStr, colStr, sev, codeStr, rule, message] = m;
    const lineNum = Number(lineStr);
    const colNum = Number(colStr);
    if (!Number.isFinite(lineNum) || !Number.isFinite(colNum)) continue;
    out.push({
      line: lineNum,
      column: colNum,
      length: lengthOfTokenAt(sourceLines, lineNum, colNum) ?? 1,
      severity: sev === "warning" ? "warning" : "error",
      message: rule ? `[${rule}] ${message ?? ""}` : (message ?? ""),
      code: `TS${codeStr ?? ""}`,
    });
  }
  return out;
}

/**
 * Best-effort length of the identifier-like token starting at (`line`,
 * `column`) in `source`. Falls back to 1 when no token is found.
 */
function lengthOfTokenAt(
  lines: readonly string[],
  line: number,
  column: number,
): number | null {
  if (line < 1 || line > lines.length) return null;
  const text = lines[line - 1] ?? "";
  const start = Math.max(0, column - 1);
  const match = text.slice(start).match(/^[\w$]+/);
  if (!match) return null;
  return match[0].length;
}
