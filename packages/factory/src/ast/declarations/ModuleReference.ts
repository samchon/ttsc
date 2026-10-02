import type { EntityName } from "../names/EntityName";
import type { ExternalModuleReference } from "./ExternalModuleReference";

/**
 * The reference of an import-equals declaration.
 *
 * @evidence contracts/common.md#principled-implementation EntityName and ExternalModuleReference distinguish an entity alias from require-style import-equals syntax without resolving either target.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns reference alternatives while ImportEqualsDeclaration owns the local binding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reference forms encode caller syntax without loader monkey patches or fixture-specific targets.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies import-equals ownership and native alternatives; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleReference = EntityName | ExternalModuleReference;
