import { readEffectiveCompilerOptions } from "../../compiler/internal/readEffectiveCompilerOptions";
import type { ITtscParsedProjectConfig } from "../../structures/internal/ITtscParsedProjectConfig";

/**
 * The compiler arguments of a runtime build: the caller's own, plus whatever
 * requests decorator/JSX lowering and JavaScript emission for Node. This is not
 * certification of every runtime API or syntax feature. The config, source, and
 * ordinary `ttsc` output never change.
 *
 * Two settings hand syntax Node cannot parse to a later tool, and each is
 * replaced only in the runtime build, after the forwarded flags so it wins over
 * them as well as over the config:
 *
 * - `target: ESNext` preserves proposal decorators. The build lowers to ES2025,
 *   TypeScript-Go's latest standard target, which runs the upstream decorator
 *   lowering policy while retaining the standard class-field target, without
 *   changing the implied library or module kind.
 * - `jsx: preserve` and `jsx: react-native` keep JSX. The build compiles it with
 *   the JSX runtime the type-check already reads.
 *
 * A forwarded `--noEmit` or `--emitDeclarationOnly` is switched back off as
 * well. ttsx forwards the flags before the entry to its type-check, and the
 * check is unchanged by them, but the runtime build is that check's emit, and
 * without JavaScript there is nothing to run.
 *
 * A caller coordinating one build may supply its effective-options reader for
 * this exact project and forwarded arguments. Null preserves the compiler's
 * argument-rejection path; omission creates the reader here.
 *
 * @evidence contracts/common.md#principled-implementation Effective compiler options determine runtime-only target/JSX overrides; preserving implied module and library choices keeps the original check's meaning while producing executable syntax.
 * @evidence contracts/common.md#clear-and-simple-design One ordered argument adapter separates runtime emit policy from project configuration and leaves invalid-argument diagnostics to the compiler.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts ES2025 and JSX discriminants reflect supported compiler transforms; no source-text patch or consumer-specific override substitutes for emission.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain decorator, JSX, library and no-emit decisions and their runtime-only scope without changing the user's project.
 * @evidence contracts/portability.md#os-neutral-implementation Effective-option resolution delegates response-file parsing to the compiler owner and returns argument tokens rather than shell text or platform-specific paths.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned copied argv array belongs to the caller. An internally prepared effective reader is call-local; a supplied reader and its captured config/assignment records remain caller-owned. Delegated response inspection and native showConfig/capture own cleanup attempts; this adapter retains no history or process handle.
 * @evidence contracts/performance.md#efficient-algorithms Copying A forwarded argument references and text/value queries precedes fixed policy additions. Without a supplied reader, delegated argv/response inspection, native showConfig, full output decoding and JSON parsing are additional input/native costs; the returned argv need not be short.
 * @evidence contracts/performance.md#reuse-equivalent-work One effective reader serves this call's policy queries, and an actual reader supplied for the same project/arguments avoids preparation repeated across coordinated build adapters. The caller owns that equivalence premise; this adapter caches no historical argv result.
 */
export function runtimeCompilerArgs(
  project: ITtscParsedProjectConfig,
  passthrough: readonly string[] = [],
  binary?: string,
  effectiveOptions?: ReturnType<typeof readEffectiveCompilerOptions>,
): string[] {
  const option =
    effectiveOptions === undefined
      ? readEffectiveCompilerOptions(project, passthrough, binary)
      : effectiveOptions;
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
  // flag too. Explicit false operands clear the two native boolean assignments.
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
