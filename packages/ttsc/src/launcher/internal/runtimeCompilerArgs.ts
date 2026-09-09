import { normalizeFlagToken } from "../../flags/schema";

/**
 * Lower proposal syntax in ESNext runtime builds without changing the implied
 * library or module kind. TypeScript-Go preserves standard decorators at
 * ESNext, while Node cannot parse them. Its latest standard target, ES2025,
 * runs the upstream decorator transform and keeps native class-field
 * semantics.
 */
export function runtimeCompilerArgs(
  compilerOptions: Record<string, unknown>,
  passthrough: readonly string[] = [],
): string[] {
  const option = (name: string, aliases: readonly string[] = []): unknown => {
    let value = compilerOptions[name];
    for (let i = 0; i < passthrough.length; i++) {
      const token = passthrough[i]!;
      if (!token.startsWith("-")) continue;
      const normalized = normalizeFlagToken(token);
      if (normalized !== name.toLowerCase() && !aliases.includes(normalized)) {
        continue;
      }
      const next = passthrough[i + 1];
      value =
        name === "noLib" &&
        next !== "true" &&
        next !== "false" &&
        next !== "null"
          ? true
          : next === "null"
            ? undefined
            : next;
    }
    return value;
  };
  const target = option("target", ["t"]);
  if (typeof target !== "string" || target.toLowerCase() !== "esnext") {
    return [...passthrough];
  }

  const args = [...passthrough, "--target", "es2025"];
  const module = option("module", ["m"]);
  if (module == null || String(module).toLowerCase() === "none") {
    // GetEmitModuleKind derives ESNext from the original target.
    args.push("--module", "esnext");
  }
  const noLib = option("noLib");
  if (option("lib") == null && noLib !== true && noLib !== "true") {
    // The references in TypeScript-Go's lib.esnext.full.d.ts. An explicit lib
    // (including []) or noLib keeps the user's exact library selection.
    args.push(
      "--lib",
      "esnext,dom,webworker.importscripts,scripthost,dom.iterable,dom.asynciterable",
    );
  }
  return args;
}
