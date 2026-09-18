import { resolveTsgo } from "../../compiler/internal/resolveTsgo";
import { outputText } from "../../compiler/internal/outputText";
import { spawnNative } from "../../compiler/internal/spawnNative";
import { normalizeFlagToken } from "../../flags/normalizeFlagToken";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";

/**
 * The compiler arguments of a runtime build: the caller's own, plus whatever
 * makes the emit something Node can execute. The project's config, source, and
 * ordinary `ttsc` output never change.
 *
 * Two settings hand syntax Node cannot parse to a later tool, and each is
 * replaced only in the runtime build, after the forwarded flags so it wins
 * over them as well as over the config:
 *
 * - `target: ESNext` preserves proposal decorators. The build lowers to ES2025,
 *   TypeScript-Go's latest standard target, which runs the upstream decorator
 *   transform and keeps native class-field semantics, without changing the
 *   implied library or module kind.
 * - `jsx: preserve` and `jsx: react-native` keep JSX. The build compiles it
 *   with the factory the project declares (samchon/ttsc#1408).
 */
export function runtimeCompilerArgs(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
): string[] {
  let compilerOptions = project.compilerOptions;
  const hasResponseFile = passthrough.some((token) => token.startsWith("@"));
  if (hasResponseFile) {
    // Let TypeScript-Go own response-file quoting, nesting, cwd, and ordering.
    // Replaying just the visible flags would overwrite options inside @files.
    const tsgo = resolveTsgo({ cwd: project.root, binary });
    const result = spawnNative(
      tsgo.binary,
      ["-p", project.path, ...passthrough, "--showConfig"],
      { cwd: project.root, encoding: "utf8" },
    );
    // Preserve the original compiler's diagnostic when its arguments are invalid.
    if (result.status !== 0) return [...passthrough];
    compilerOptions = JSON.parse(outputText(result.stdout)).compilerOptions;
  }
  const option = (name: string, aliases: readonly string[] = []): unknown => {
    if (hasResponseFile) return compilerOptions[name];
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
  const args = [...passthrough];
  const target = option("target", ["t"]);
  if (typeof target === "string" && target.toLowerCase() === "esnext") {
    args.push("--target", "es2025");
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
  }
  const jsx = option("jsx");
  if (typeof jsx === "string" && PRESERVED_JSX.has(jsx.toLowerCase())) {
    // A project that preserves JSX hands it to another tool, and Node is not
    // that tool. The runtime build compiles it with the factory the project
    // already declares: a classic `jsxFactory` or `jsxFragmentFactory` keeps
    // the classic transform, and otherwise the automatic runtime is used,
    // which reads `jsxImportSource` (default `react`) and per-file pragmas.
    const classic =
      option("jsxFactory") != null || option("jsxFragmentFactory") != null;
    args.push("--jsx", classic ? "react" : "react-jsx");
  }
  return args;
}

/**
 * JSX modes that leave the syntax in the output for a downstream tool. Node
 * cannot parse either, so a runtime build replaces them.
 */
const PRESERVED_JSX: ReadonlySet<string> = new Set(["preserve", "react-native"]);
