import type { IDeclaredPaths } from "./IDeclaredPaths";
import { findDeclaredValue } from "./findDeclaredValue";

/**
 * Locate the nearest `compilerOptions.paths` declaration in the `extends` chain
 * rooted at `tsconfig`. The own config wins over its bases; within an `extends`
 * array, later entries win over earlier ones. `seen` breaks circular chains;
 * the compiler reports the actual config error.
 */
export function findDeclaredPaths(
  tsconfig: string,
  seen: Set<string>,
): IDeclaredPaths | null {
  const declared = findDeclaredValue(
    tsconfig,
    (parsed) => {
      const own = (parsed as { compilerOptions?: { paths?: unknown } })
        .compilerOptions?.paths;
      return typeof own === "object" && own !== null && !Array.isArray(own)
        ? (own as Record<string, unknown>)
        : undefined;
    },
    seen,
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, paths: declared.value };
}
