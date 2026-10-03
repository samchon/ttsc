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
 *
 * @evidence contracts/common.md#principled-implementation Rendered-format parsing and typed diagnostic identity are grouped without conflating report suppression with successful build status.
 * @evidence contracts/common.md#clear-and-simple-design Public parsing, terminal-text cleaning and fallback selection share private normalizers/indexing rather than duplicating compiler report semantics across build lanes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The API compares actual producer reports and preserves plugin codes instead of treating selected error strings as authoritative expected answers.
 * @evidence contracts/common.md#meaningful-documentation Namespace prose explains both producer formats and the failed-plugin fallback purpose; selected functions state coordinates, identity rules and null outcomes.
 *
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This namespace grouping owns no native operation; selected parsing and filtering functions acknowledge their filename boundary separately.
 * @evidenceExclude contracts/performance.md#efficient-algorithms Processing choices belong to the selected parser/filter functions, not this namespace representation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The grouping retains no diagnostic index across invocations; each selection operation owns its applicable reuse.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No resource or historical diagnostic store is acquired by the namespace.
 */
export namespace CompilerDiagnostics {
  /**
   * Return fallback diagnostics the failed plugin did not already report.
   * Matching offsets take precedence only when both reports carry offsets;
   * otherwise rendered line and column determine the position. A completely
   * redundant fallback returns null. Partial filtering retains selected report
   * context, drops summary lines, and rejoins text with LF separators; text
   * before the first recognized report and nonindented context also survives.
   *
   * @evidence contracts/common.md#principled-implementation Identity includes category, typed code, file and headline; separate offset and rendered-position indexes preserve the pairwise rule when an offset is missing.
   * @evidence contracts/common.md#clear-and-simple-design Structured selection precedes rendered-text filtering, keeping diagnostic identity in one index helper and continuation handling in one text helper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Fallback suppression compares actual reports and preserves surviving output; it does not recognize fixed error codes or suppress a failing status to satisfy an example.
   * @evidence contracts/common.md#meaningful-documentation The native comment explains position precedence, the null result and text-context preservation with prose separated from tags.
   * @evidence contracts/portability.md#os-neutral-implementation Rendered relative filenames are resolved by node:path against the compiler cwd; report filenames otherwise retain the producer's native spelling without guessed case folding.
   * @evidence contracts/performance.md#efficient-algorithms Separate identity/offset/position indexes avoid failure-by-fallback and selected-by-line cross products. Building and querying keys includes headline scans, JSON tuple serialization and hashing of diagnostic text; partial stdout/stderr filtering performs ANSI removal, format regex matching and native path normalization per line. Work and temporary records depend on diagnostic, line and text sizes; regex backtracking is not bounded by index cardinality.
   * @evidence contracts/performance.md#reuse-equivalent-work The selected diagnostic index is shared by stdout and stderr filtering, since both outputs refer to the same surviving population.
   *
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Diagnostic indexes and output arrays are invocation-local; this function owns no persistent cache or handle.
   */
  export function filterReportedTypeScriptDiagnostics(
    failure: TtscBuildResult,
    typechecked: TtscBuildResult,
    cwd: string,
  ): TtscBuildResult | null {
    if (typechecked.diagnostics.length === 0) {
      return typechecked.status === 0 ? null : typechecked;
    }
    const alreadyReported = indexCompilerDiagnostics(failure.diagnostics);
    const diagnostics = typechecked.diagnostics.filter(
      (diagnostic) => !alreadyReported(diagnostic),
    );
    if (diagnostics.length === 0) return null;
    if (diagnostics.length === typechecked.diagnostics.length)
      return typechecked;
    const selected = indexCompilerDiagnostics(diagnostics);
    return {
      ...typechecked,
      diagnostics,
      stderr: filterCompilerDiagnosticText(typechecked.stderr, selected, cwd),
      stdout: filterCompilerDiagnosticText(typechecked.stdout, selected, cwd),
    };
  }

  /** Remove diagnostic lines absent from the selected structured result. */
  function filterCompilerDiagnosticText(
    text: string,
    selected: (diagnostic: ITtscCompilerDiagnostic) => boolean,
    cwd: string,
  ): string {
    const out: string[] = [];
    let keepContinuation = true;
    for (const line of text.split(/\r?\n/)) {
      const plain = stripAnsi(line);
      const diagnostic = parseDiagnosticLine(plain, cwd);
      if (diagnostic !== null) {
        keepContinuation = selected(diagnostic);
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

  /**
   * Index pairwise diagnostic matches without treating them as an equivalence
   * relation: an offset-bearing report can match an offset-free report by
   * rendered position, even when two offset-bearing reports do not match.
   * Separate fallback positions preserve that distinction. NaN never equals
   * itself under the original strict numeric comparison.
   */
  function indexCompilerDiagnostics(
    diagnostics: readonly ITtscCompilerDiagnostic[],
  ): (diagnostic: ITtscCompilerDiagnostic) => boolean {
    const indexed = new Map<
      string,
      {
        starts: Set<number>;
        positions: Set<string>;
        fallbackPositions: Set<string>;
      }
    >();
    for (const diagnostic of diagnostics) {
      const identity = diagnosticIdentity(diagnostic);
      if (identity === undefined) continue;
      let positions = indexed.get(identity);
      if (positions === undefined) {
        positions = {
          starts: new Set(),
          positions: new Set(),
          fallbackPositions: new Set(),
        };
        indexed.set(identity, positions);
      }
      const rendered = diagnosticRenderedPosition(diagnostic);
      if (rendered !== undefined) {
        positions.positions.add(rendered);
        if (diagnostic.start === undefined)
          positions.fallbackPositions.add(rendered);
      }
      if (diagnostic.start !== undefined && !Number.isNaN(diagnostic.start))
        positions.starts.add(diagnostic.start);
    }
    return (diagnostic) => {
      const identity = diagnosticIdentity(diagnostic);
      if (identity === undefined) return false;
      const positions = indexed.get(identity);
      if (positions === undefined) return false;
      const rendered = diagnosticRenderedPosition(diagnostic);
      if (diagnostic.start === undefined)
        return rendered !== undefined && positions.positions.has(rendered);
      return (
        (!Number.isNaN(diagnostic.start) &&
          positions.starts.has(diagnostic.start)) ||
        (rendered !== undefined && positions.fallbackPositions.has(rendered))
      );
    };
  }

  /** Preserve numeric versus plugin-string codes in an unambiguous tuple. */
  function diagnosticIdentity(
    diagnostic: ITtscCompilerDiagnostic,
  ): string | undefined {
    if (typeof diagnostic.code === "number" && Number.isNaN(diagnostic.code))
      return undefined;
    return JSON.stringify([
      diagnostic.category,
      typeof diagnostic.code,
      String(diagnostic.code),
      diagnostic.file,
      diagnosticHeadline(diagnostic.messageText),
    ]);
  }

  /** Missing positions match missing positions, but NaN coordinates never do. */
  function diagnosticRenderedPosition(
    diagnostic: ITtscCompilerDiagnostic,
  ): string | undefined {
    if (Number.isNaN(diagnostic.line) || Number.isNaN(diagnostic.character))
      return undefined;
    return JSON.stringify([
      diagnostic.line === undefined ? null : String(diagnostic.line),
      diagnostic.character === undefined ? null : String(diagnostic.character),
    ]);
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
   * Codes may also be bare digits or plugin-defined tokens. Line and column
   * retain the producer's one-based coordinates. Relative filenames remain
   * relative when cwd is absent. Returns null for an unrecognized line.
   *
   * @evidence contracts/common.md#principled-implementation Anchored format recognizers distinguish file and global reports; only TS-prefixed or bare numeric codes become numbers, preserving plugin-code identity.
   * @evidence contracts/common.md#clear-and-simple-design Three explicit render formats feed the same category, code and filename normalizers; unrecognized text is left for the caller's continuation handling.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Patterns implement compiler and plugin render formats instead of matching selected messages or coercing arbitrary plugin prefixes into TypeScript numbers.
   * @evidence contracts/common.md#meaningful-documentation Native documentation gives accepted forms, coordinate units, optional cwd meaning and the null outcome in separated paragraphs.
   * @evidence contracts/portability.md#os-neutral-implementation Native node:path recognizes absolute paths and resolves relative paths against cwd; greedy filename captures retain drive colons without treating protocol spelling as filesystem identity.
   * @evidence contracts/performance.md#efficient-algorithms At most three anchored format matches precede category/code conversion and native filename normalization. Captures, numeric token conversion and path text contribute processing/storage cost; the greedy/optional filename patterns can backtrack on malformed lines, so three recognizers do not establish a linear-time ceiling.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work This parser coordinates no repeated producer or cross-request computation; diagnostic indexing belongs to the selecting operation.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A parsed record is returned immediately; the parser retains no history or native resource.
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
   * Preserve absolute filenames and resolve relative filenames against cwd when
   * supplied; an absent cwd preserves the relative producer spelling.
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
   *
   * @evidence contracts/common.md#principled-implementation The CSI pattern removes terminal control sequences while retaining diagnostic text for format parsing.
   * @evidence contracts/common.md#clear-and-simple-design One text transformation serves both structured parsing and selected-output filtering without coupling either caller's state.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts This strips recognized control syntax, not error messages or producer-specific expected outputs.
   * @evidence contracts/common.md#meaningful-documentation The native comment states the parsing purpose and supported escape family; descriptive prose precedes the acknowledgment block.
   *
   * @evidenceExclude contracts/portability.md#os-neutral-implementation This function transforms terminal text without accessing native paths, filesystem capabilities or processes.
   *
   * @evidence contracts/performance.md#efficient-algorithms One global scan constructs the stripped text in space proportional to the input; no per-character array or repeated prefix concatenation is used.
   *
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Stripping one supplied string does not coordinate a shared producer or retained cross-request result.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The string transformation owns no retained cache or handle.
   */
  export function stripAnsi(text: string): string {
    return text.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "");
  }
}
