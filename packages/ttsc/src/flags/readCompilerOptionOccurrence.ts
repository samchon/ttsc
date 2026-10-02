import { COMPILER_ENUM_WHITESPACE } from "./COMPILER_ENUM_WHITESPACE";
import { COMPILER_OPTIONS } from "./COMPILER_OPTIONS";
import type { CompilerOptionSpec } from "./CompilerOptionSpec";
import { normalizeFlagToken } from "./normalizeFlagToken";

/**
 * Read one unexpanded argv frame using pinned native command-line grammar.
 * Scalars consume dash operands; lists consume only a nonempty parsed list or
 * its diagnostic, and configuration-only options admit explicit resets.
 * Response files remain frame boundaries owned by the caller/native parser.
 *
 * @evidence contracts/common.md#principled-implementation Generated native kind, element and configuration-only metadata drive scalar, boolean and list lookahead; returned width, optional assignment and deletion-boundary marker retain those distinct decisions. List-level Unicode White_Space follows Go TrimSpace, enum-item emptiness uses the separately generated native IsWhiteSpaceLike set, and rejected inline names remain unknown native options.
 * @evidence contracts/common.md#clear-and-simple-design One pure occurrence reader owns consumption and assignment; callers advance their own cursor and attach launcher semantics separately. One local record serves classification, forwarding and removal without retaining an argv cursor.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Grammar and boundary markers come from native declarations without guessing values from source suffixes, spelling exceptions or treating a dash operand as another launcher request.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs state the unexpanded-frame scope and distinctions among scalar, list and config-only rules; the private result prose explains removal fences, unknown metadata and absent boolean assignments, while each member documents its role.
 * @evidence contracts/performance.md#efficient-algorithms Metadata lookup is constant-time after a token-name scan; list lookahead scans its value and components linearly. Temporary component/rune arrays grow with only that value, and callers advance by the returned width.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This pure lookahead reads current invocation argv; immutable generated tables are already shared by module identity, and no per-argv computation is coordinated or cached here.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only a returned occurrence and transient value components are created; no argv history, process, handle or persistent invocation state is retained.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This deterministic argv grammar reads generated metadata and Unicode trimming rules without interpreting operands as filesystem paths, expanding response files or probing a native executable; the spawning/compiler owners supply those OS capabilities.
 */
export function readCompilerOptionOccurrence(
  argv: readonly string[],
  index: number,
): CompilerOptionOccurrence {
  const token = argv[index];
  const option = token?.startsWith("-") === true && !token.includes("=")
    ? COMPILER_OPTIONS.get(normalizeFlagToken(token))
    : undefined;
  if (option === undefined) return { width: 1, needsFence: false };
  const next = argv[index + 1];
  if (next === undefined)
    return {
      option,
      width: 1,
      needsFence: false,
      booleanValue: option.kind === "boolean" && !option.configOnly ? true : undefined,
    };
  if (next === "null")
    return { option, width: 2, needsFence: false,
      booleanValue: option.kind === "boolean" ? false : undefined };
  if (option.kind === "boolean")
    return {
      option,
      width: next === "true" || next === "false" ? 2 : 1,
      booleanValue: option.configOnly && next !== "false"
        ? undefined : next !== "false",
      needsFence: next.startsWith("-"),
    };
  if (option.configOnly)
    return { option, width: next !== "" && !next.startsWith("-") ? 2 : 1,
      needsFence: next.startsWith("-") };
  if (option.kind === "list") {
    // Go strings.TrimSpace follows Unicode White_Space, which excludes FEFF
    // and includes U+0085; JavaScript trim uses a different character set.
    let start = 0;
    let end = next.length;
    const whitespace = /\p{White_Space}/u;
    while (start < end && whitespace.test(next[start]!)) start++;
    while (end > start && whitespace.test(next[end - 1]!)) end--;
    const trimmed = next.slice(start, end);
    // Enum members undergo the compiler's IsWhiteSpaceLike trim as well;
    // FEFF and zero-width space can therefore make every member empty.
    const empty = trimmed === "" || trimmed.startsWith("-") ||
      trimmed.split(",").every((part) => option.element === "string"
        ? part === ""
        : [...part].every((character) => COMPILER_ENUM_WHITESPACE.has(character)));
    return { option, width: empty ? 1 : 2, needsFence: next.startsWith("-") };
  }
  return { option, width: 2, needsFence: false };
}

/**
 * One native argv occurrence and the lookahead boundary it establishes.
 * Undefined metadata denotes a positional token or an unknown option. An
 * undefined boolean value denotes a nonboolean option or a config-only
 * boolean request the native compiler rejects without assigning a value.
 *
 */
interface CompilerOptionOccurrence {
  /** Native declaration, absent for non-options and unknown spellings. */
  readonly option?: CompilerOptionSpec;

  /** Option token plus the next token only when native parsing consumes it. */
  readonly width: 1 | 2;

  /** Native boolean assignment; false also represents an explicit null reset. */
  readonly booleanValue?: boolean;

  /** Whether removing the following option requires an empty lookahead fence. */
  readonly needsFence: boolean;
}

