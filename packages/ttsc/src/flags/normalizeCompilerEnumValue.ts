import { COMPILER_ENUM_WHITESPACE } from "./COMPILER_ENUM_WHITESPACE";
import { COMPILER_OPTION_ASCII_FOLDS } from "./COMPILER_OPTION_ASCII_FOLDS";

/**
 * Normalize an enum discriminant at the boundary that supplied it.
 *
 * Native command-line enum parsing trims IsWhiteSpaceLike before lookup; JSON
 * enum parsing does not trim. Both use Unicode simple lowercase. Generated
 * folds into the pinned compiler's ASCII enum domain preserve the native
 * spelling where JavaScript lowercase expands a character instead. Dashes
 * remain value data, and an empty discriminant represents the native reset.
 * This projection does not validate membership in an option's enum map.
 *
 * @evidence contracts/common.md#principled-implementation CLI-only trimming follows the generated native IsWhiteSpaceLike table; both origins use generated simple folds before lowercase, preserve leading dashes and distinguish an empty reset from a padded JSON value.
 * @evidence contracts/common.md#clear-and-simple-design One pure boundary normalizer separates enum data from option-name normalization and makes CLI versus JSON origin explicit.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Enum membership and invalid-value diagnostics remain native-owned; the adapter does not strip a value's dash or trim JSON to admit an invalid spelling.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains origin-specific trimming, Unicode folding, the reset outcome and the projection's validation boundary.
 * @evidence contracts/performance.md#efficient-algorithms CLI boundary scans, Unicode fold replacement and lowercase conversion are linear in token length, using immutable generated lookup tables instead of scanning declarations. Intermediate slices/replacements and the returned string grow with that token; JSON skips boundary trimming.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each token belongs to its caller's current option origin; immutable native tables are module-shared, and no invocation or historical value cache is retained.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the normalized string is returned; transient string slices and replacements create no resource or retained history.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation This origin-specific Unicode string transformation interprets no filesystem path or process capability; generated native whitespace/fold policy is module data, and callers own any native compiler validation.
 */
export function normalizeCompilerEnumValue(
  value: string,
  origin: "cli" | "json",
): string | null {
  let start = 0;
  let end = value.length;
  if (origin === "cli") {
    while (start < end && COMPILER_ENUM_WHITESPACE.has(value[start]!)) start++;
    while (end > start && COMPILER_ENUM_WHITESPACE.has(value[end - 1]!)) end--;
  }
  const normalized = value
    .slice(start, end)
    .replace(
      /[^\x00-\x7f]/gu,
      (character) => COMPILER_OPTION_ASCII_FOLDS.get(character) ?? character,
    )
    .toLowerCase();
  return normalized === "" ? null : normalized;
}
