import type { EntityName } from "../names/EntityName";
import type { ExternalModuleReference } from "./ExternalModuleReference";

/**
 * The reference of an import-equals declaration.
 *
 * @evidence contracts/common.md#principled-implementation EntityName and ExternalModuleReference distinguish an entity alias from require-style import-equals syntax without resolving either target.
 * @evidence contracts/common.md#clear-and-simple-design One alias owns reference alternatives while ImportEqualsDeclaration owns the local binding.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reference forms encode caller syntax without loader monkey patches or fixture-specific targets.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies import-equals ownership and native alternatives; prose/tag separation follows the documentation skill.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleReference = EntityName | ExternalModuleReference;
