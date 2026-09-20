import path from "node:path";
import { resolveProjectIdentity } from "ttsc/path-identity";

/**
 * The project's config path and config directory as the compiler spells them
 * (samchon/ttsc#1456).
 *
 * The compiler resolves the selected config and the project root to their
 * physical paths before it loads the program or hands a plugin its root, so
 * every path the adapter writes for the compiler, the wrapper tsconfig's
 * absolutized values and the plugin config anchor among them, is anchored where
 * the compiler would anchor it: the compiler's own identity rule answers, so
 * the two cannot drift apart. A config the rule cannot locate is left as named;
 * the compile then reports it.
 *
 * @param tsconfig The project's tsconfig as the adapter names it.
 * @param projectRoot The project root the compile declares.
 */
export function compilerProjectSpelling(
  tsconfig: string,
  projectRoot: string,
): { configDir: string; tsconfig: string } {
  try {
    const identity = resolveProjectIdentity({
      cwd: projectRoot,
      projectRoot,
      tsconfig,
    });
    return {
      configDir: path.dirname(identity.physicalConfigPath),
      tsconfig: identity.physicalConfigPath,
    };
  } catch {
    return { configDir: path.dirname(tsconfig), tsconfig };
  }
}
