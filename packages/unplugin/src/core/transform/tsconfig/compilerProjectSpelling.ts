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
 * the shared identity selector anchors it at this observation. Failed realpath
 * can retain lexical spelling inside a successful identity result; a thrown
 * selection preserves the original tsconfig and its dirname. Neither fallback
 * proves physical resolution or guards against later native retargeting.
 *
 * @param tsconfig The project's tsconfig as the adapter names it.
 * @param projectRoot The project root the compile declares.
 *
 * @evidence contracts/common.md#principled-implementation The shared project-identity resolver supplies its best-effort config address; realpath failure can preserve selected lexical spelling, while a thrown selection preserves the original input. Later compilation owns diagnostics and current filesystem observation.
 * @evidence contracts/common.md#clear-and-simple-design The adapter projects the shared identity into config spelling and directory instead of implementing another canonicalization policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Failed identity resolution is not converted into a fabricated config or fixed-path fallback that could select another project.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain the compiler anchor and unresolved-input behavior; parameter tags identify both project addresses.
 * @evidence contracts/portability.md#os-neutral-implementation The shared project selector owns native resolution and best-effort realpath fallback, while Node dirname projects that address. A field named physicalConfigPath is not successful native resolution proof, nor a prediction of unchanged later compiler identity.
 * @evidence contracts/performance.md#efficient-algorithms
 *   Nonempty explicit config selection delegates existence/directory/config
 *   candidate probes and two realpath attempts; an empty config allows the
 *   selector's D-depth ancestor search. Native/path text work and dirname
 *   allocation are not constant merely because this projection has no loop.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work
 *   This projects one current selection and coordinates no cross-request
 *   result; retaining it for later use requires the generation's own proof.
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
