import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";

/**
 * The compiler arguments of a runtime build: the caller's own, plus whatever
 * makes the emit something Node can execute. The project's config, source, and
 * ordinary `ttsc` output never change.
 *
 * Two settings hand syntax Node cannot parse to a later tool, and each is
 * replaced only in the runtime build, after the forwarded flags so it wins over
 * them as well as over the config:
 *
 * - `target: ESNext` preserves proposal decorators. The build lowers to ES2025,
 *   TypeScript-Go's latest standard target, which runs the upstream decorator
 *   transform and keeps native class-field semantics, without changing the
 *   implied library or module kind.
 * - `jsx: preserve` and `jsx: react-native` keep JSX. The build compiles it with
 *   the JSX runtime the type-check already reads (samchon/ttsc#1408).
 *
 * A forwarded `--noEmit` or `--emitDeclarationOnly` is switched back off as
 * well. ttsx forwards the flags before the entry to its type-check, and the
 * check is unchanged by them, but the runtime build is that check's emit, and
 * without JavaScript there is nothing to run.
 */
export function runtimeCompilerArgs(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
): string[] {
  const option = readEffectiveCompilerOptions(project, passthrough, binary);
  // Preserve the original compiler's diagnostic when its arguments are invalid.
  if (option === null) return [...passthrough];
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
    // that tool. The runtime build compiles it the way the compiler already
    // checks it. A `jsxImportSource` makes the checker read JSX as the automatic
    // runtime even under `preserve`, so it selects `react-jsx`. Without one, a
    // `jsxFactory`, `jsxFragmentFactory`, or `reactNamespace` declares the
    // classic transform, and a project that declares nothing gets the automatic
    // runtime's default source, `react`.
    const factories = ["jsxFactory", "jsxFragmentFactory", "reactNamespace"];
    const automatic =
      option("jsxImportSource") != null ||
      factories.every((name) => option(name) == null);
    args.push("--jsx", automatic ? "react-jsx" : "react");
    // `preserve` accepts a factory beside an import source, and `react-jsx`
    // rejects it (TS5089), so the factories the automatic runtime never reads
    // are set aside for the runtime build.
    if (automatic) {
      for (const name of factories) {
        if (option(name) != null) args.push(`--${name}`, "null");
      }
    }
  }
  // Unconditional, after every forwarded token: a response file can carry the
  // flag too, and a bare boolean flag reads as whatever token follows it.
  args.push("--noEmit", "false", "--emitDeclarationOnly", "false");
  return args;
}

/**
 * JSX modes that leave the syntax in the output for a downstream tool. Node
 * cannot parse either, so a runtime build replaces them.
 */
const PRESERVED_JSX: ReadonlySet<string> = new Set([
  "preserve",
  "react-native",
]);
