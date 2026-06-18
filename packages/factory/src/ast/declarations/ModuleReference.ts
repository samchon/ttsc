import type { EntityName } from "../names/EntityName";
import type { ExternalModuleReference } from "./ExternalModuleReference";

/**
 * The reference of an import-equals declaration.
 *
 * @author Jeongho Nam - https://github.com/samchon
 */
export type ModuleReference = EntityName | ExternalModuleReference;
