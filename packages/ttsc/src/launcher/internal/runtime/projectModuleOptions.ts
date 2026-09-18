import type { OwningModuleOptions } from "./OwningModuleOptions";

/** Narrow a resolved project's compiler options to the emit-format pair. */
export function projectModuleOptions(
  compilerOptions: Record<string, unknown>,
): OwningModuleOptions {
  return {
    ...(typeof compilerOptions.module === "string"
      ? { module: compilerOptions.module }
      : {}),
    ...(typeof compilerOptions.target === "string"
      ? { target: compilerOptions.target }
      : {}),
  };
}
