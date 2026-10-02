import type { ClassDeclaration } from "../declarations/ClassDeclaration";
import type { EnumDeclaration } from "../declarations/EnumDeclaration";
import type { FunctionDeclaration } from "../declarations/FunctionDeclaration";
import type { InterfaceDeclaration } from "../declarations/InterfaceDeclaration";
import type { TypeAliasDeclaration } from "../declarations/TypeAliasDeclaration";

/**
 * The supported function, class, interface, type-alias and enum declaration
 * forms. Their own shapes determine name presence; this alias does not require
 * an otherwise optional declaration name.
 *
 * @evidence contracts/common.md#principled-implementation The alias collects the supported function/class/interface/type-alias/enum declaration forms; their own optional names remain permissive rather than enforcing naming here.
 * @evidence contracts/common.md#clear-and-simple-design One alias groups declaration consumers while each concrete declaration owns its fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives describe declared syntax forms, without fixture-dependent declaration categories.
 * @evidence contracts/common.md#meaningful-documentation JSDoc identifies the declaration grouping and its naming limitation; prose/tag separation follows the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type definition owns no retained state, handle or running task.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type definition selects no algorithm or data structure for a computation.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type definition coordinates no computation across requests or consumers.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation A syntax type; it names no filesystem, path or process boundary.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type Declaration =
  | FunctionDeclaration
  | ClassDeclaration
  | InterfaceDeclaration
  | TypeAliasDeclaration
  | EnumDeclaration;
