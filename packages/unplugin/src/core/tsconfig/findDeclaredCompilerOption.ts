import { findDeclaredValue } from "./findDeclaredValue";

/**
 * Locate one compiler option while retaining its declaring directory.
 *
 * Own key presence is significant even for null or undefined values; the caller
 * decides whether the selected option value is usable. An optional
 * decoded-source map belongs to one caller read transaction; independent option
 * searches retain separate branch-local cycle guards.
 *
 * @evidence contracts/common.md#principled-implementation
 *   A wrapper preserves key presence through the generic selector, so the own
 *   declaration overrides inherited values without losing its directory.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   This adapter owns compilerOptions lookup while shared traversal owns config
 *   precedence and caller-specific readers own value validation.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Native declaring-directory spelling comes from the shared config walk;
 *   unknown option values remain unconverted until their semantic reader acts.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Unknown option values are retained rather than replaced by a fabricated
 *   value chosen to make generated configuration pass.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   Native paragraphs explain the declaring anchor and key-presence distinction,
 *   the facts a template-path reader needs beyond the return type.
 * @evidence contracts/performance.md#efficient-algorithms
 *   One own-key selector delegates native inheritance resolution and branch-local
 *   cycle-set copying. Search cost follows config occurrences, source bytes and
 *   visited depths; a shared source map avoids repeating decoding per option.
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   A supplied caller transaction map shares decoded sources across option
 *   searches by lexical path. Selections remain independent; changed config
 *   inputs require a fresh transaction map.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Its Set is local to the call.
 */
export function findDeclaredCompilerOption(
  tsconfig: string,
  key: string,
  configs?: Map<string, unknown>,
): { baseDir: string; value: unknown } | null {
  const declared = findDeclaredValue(
    tsconfig,
    (parsed) => {
      const options = (parsed as { compilerOptions?: Record<string, unknown> })
        .compilerOptions;
      return typeof options === "object" &&
        options !== null &&
        !Array.isArray(options) &&
        Object.prototype.hasOwnProperty.call(options, key)
        ? { value: options[key] }
        : undefined;
    },
    new Set(),
    undefined,
    configs,
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, value: declared.value.value };
}
