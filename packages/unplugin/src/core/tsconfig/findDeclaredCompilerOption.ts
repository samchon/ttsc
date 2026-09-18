import { findDeclaredValue } from "./findDeclaredValue";

/** Locate one compiler option while retaining its declaring directory. */
export function findDeclaredCompilerOption(
  tsconfig: string,
  key: string,
): { baseDir: string; value: unknown } | null {
  const declared = findDeclaredValue(
    tsconfig,
    (parsed) => {
      const options = (parsed as { compilerOptions?: Record<string, unknown> })
        .compilerOptions;
      return options !== undefined &&
        Object.prototype.hasOwnProperty.call(options, key)
        ? { value: options[key] }
        : undefined;
    },
    new Set(),
  );
  return declared === null
    ? null
    : { baseDir: declared.baseDir, value: declared.value.value };
}
