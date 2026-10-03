import { normalizeCompilerEnumValue } from "./normalizeCompilerEnumValue";
import { readCompilerOptionOccurrence } from "./readCompilerOptionOccurrence";

/**
 * Project visible compiler arguments in native frame order.
 *
 * Every frame advances by the owned occurrence reader's consumption width,
 * including scalars whose values look like flags or response files. Only an
 * unconsumed response-file token requests native expansion. Known assignments
 * use canonical option names, and a present null reset is distinct from an
 * absent assignment. Rejected configuration-only requests make no assignment.
 * Boolean assignments and enum discriminants are projected for launcher
 * decisions; other operands retain their forwarded representation. Native
 * compilation owns full value validation and list conversion.
 *
 * @evidence contracts/common.md#principled-implementation Native occurrence widths prevent reinterpreting scalar operands, canonical names retain aliases and order, and explicit null or empty enum assignments remain present resets. Config-only requests without a native boolean assignment do not overwrite earlier values.
 * @evidence contracts/common.md#clear-and-simple-design One invocation record carries an assignment map and actual response-file frames; callers use map presence for precedence and leave response expansion with the native owner.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Values remain a launcher projection rather than a fabricated validated configuration; forwarded list operands and unknown native diagnostics are not replaced by guessed schema validation or a response-file parser.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains frame consumption, reset versus absence, assignment admission and validation ownership; the private record's member comments describe the two retained facts.
 * @evidence contracts/performance.md#efficient-algorithms One advancing cursor projects argv once, with map replacement for repeated assignments; option-name normalization, enum normalization and list lookahead also scan their visited text bytes. The result holds at most the schema's distinct assigned keys plus ordered response-frame references; transient normalized strings/components grow with the current token or operand.
 * @evidence contracts/performance.md#reuse-equivalent-work Callers share this invocation record across option queries, while immutable native metadata is shared by module identity. No value from a different argv population is reused.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned map and response array transfer to the caller with module-owned canonical keys and current invocation values or normalized enum strings; no process, handle, persistent cache or historical argument population is owned here.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This argv-frame projection treats operands and response requests as data without resolving filesystem paths or reading response contents; expansion, executable discovery and native validation belong to its callers.
 */
export function readCompilerOptionValues(
  argv: readonly string[] = [],
): CompilerOptionValues {
  const values = new Map<string, unknown>();
  const responseFiles: string[] = [];
  for (let index = 0; index < argv.length; ) {
    const occurrence = readCompilerOptionOccurrence(argv, index);
    const option = occurrence.option;
    const next = argv[index + 1];
    if (argv[index]!.startsWith("@")) responseFiles.push(argv[index]!);
    if (option !== undefined) {
      if (next === "null") values.set(option.name, null);
      else if (option.kind === "boolean") {
        if (occurrence.booleanValue !== undefined) {
          values.set(option.name, occurrence.booleanValue);
        }
      } else if (!option.configOnly) {
        if (option.kind === "list") values.set(option.name, next ?? []);
        else if (occurrence.width === 2) {
          values.set(
            option.name,
            option.kind === "enum"
              ? normalizeCompilerEnumValue(next!, "cli")
              : next,
          );
        }
      }
    }
    index += occurrence.width;
  }
  return { values, responseFiles };
}

/** Invocation-local assignments and the unconsumed response expansion requests. */
interface CompilerOptionValues {
  /**
   * Canonical names with last assigned values; map presence retains a null
   * reset.
   */
  readonly values: ReadonlyMap<string, unknown>;

  /** Response-file tokens found at native argv frame boundaries, in their order. */
  readonly responseFiles: readonly string[];
}
