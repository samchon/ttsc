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
 *
 * @evidence contracts/common.md#principled-implementation The compiler's existing project-identity resolver supplies the physical config address; inability to resolve preserves the original input so the compile owns its diagnostic.
 * @evidence contracts/common.md#clear-and-simple-design The adapter projects the shared identity into config spelling and directory instead of implementing another canonicalization policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed identity resolution is not converted into a fabricated config or fixed-path fallback that could select another project.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the compiler anchor and unresolved-input behavior; parameter tags identify both project addresses.
 * @evidence contracts/portability.md#os-neutral-implementation The existing compiler project-identity API owns physical/native path semantics, while Node dirname preserves the selected volume and separators; unresolved input remains a compiler-owned error.
 * @evidenceExclude contracts/performance.md#efficient-algorithms
 *   No loop or traversal of its own; constant work apart from delegated
 *   calls.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   Keeps no cache of its own and computes each value once.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources
 *   Acquires no handle, timer or retained state of its own.
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
