import { SEMANTIC_CONFIG_PATH_ENV } from "./SEMANTIC_CONFIG_PATH_ENV";

/** Drop an outer generated wrapper's config owner from an unrelated child run. */
export function clearInheritedSemanticConfigPath(
  env: NodeJS.ProcessEnv,
  callerEnv: NodeJS.ProcessEnv | undefined,
): void {
  if (callerEnv?.[SEMANTIC_CONFIG_PATH_ENV] === undefined) {
    delete env[SEMANTIC_CONFIG_PATH_ENV];
  }
}
