/**
 * Parsed canonical option keys with textual or boolean values.
 *
 * @evidence contracts/common.md#principled-implementation ReadonlyMap represents absent options distinctly from false and empty text, with value kinds preserved.
 * @evidence contracts/common.md#clear-and-simple-design One map avoids separate alias-indexed result objects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The public view is readonly rather than mutating consumer options during later validation.
 * @evidence contracts/common.md#meaningful-documentation The native headline explains canonical keys and the two stored value categories.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ParsedLauncherOptions declares a data shape or groups members and owns no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ParsedLauncherOptions declares a data shape or groups members and chooses no algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ParsedLauncherOptions declares a data shape or groups members and coordinates no computation across requests.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ParsedLauncherOptions declares a data shape or groups members and performs no filesystem, path or process operation.
 */
export type ParsedLauncherOptions = ReadonlyMap<string, string | boolean>;
