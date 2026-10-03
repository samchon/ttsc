import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  fs,
  goPath,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: a forwarded `--strict` flag is honored on a project
 * that configures a ttsc plugin.
 *
 * A plugin-configured project builds through native sidecars, not a plain
 * `tsgo` spawn, so a tsgo flag the `ttsc` launcher forwards must travel into
 * those sidecars (as the `--tsgo-args` payload) and merge onto their compiler
 * options. The tsconfig here sets `strict: false`; a strict-null error
 * therefore proves `ttsc --strict` overrode the project setting end-to-end
 * through the plugin lane, not only on the plain build path.
 *
 * 1. Configure a `@ttsc/lint` project whose tsconfig disables strict mode, with a
 *    possibly-null dereference in the source.
 * 2. Run `ttsc --noEmit --strict`.
 * 3. Assert a non-zero exit and a strict-null diagnostic in the output.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual ttsc --strict must reject the nullable dereference even though this plugin project configures strict false.
 * @evidence contracts/testing.md#independent-expectations TypeScript strict-null semantics require a diagnostic for x.length when x may be null; literal nonzero exit and null diagnostic do not derive from the launcher.
 * @evidence contracts/testing.md#distinguishing-cases Owns explicit strict override in the native plugin lane against authored strict:false. This body does not run an independent permissive baseline; normal clean and rule-failure contributions have separate owners.
 * @evidence contracts/testing.md#execution-ownership TestExecutor discovers this named corpus-ttsc export in the generic E2E population; it invokes the public launcher with the workspace-linked lint producer, not a packed installation or an independently selected Linux-only entry.
 * @evidence contracts/e2e.md#necessary-boundary CLI option serialization into the native lint compiler must override tsconfig; a direct Go command test cannot prove that the JS launcher passes the option.
 * @evidence contracts/e2e.md#shared-execution setupLintProject links the unchanged workspace lint producer and this invocation explicitly selects the suite-owned shared cache. Consumer source/options differ; the diagnostic does not independently certify a hit, total preparations or minimum process cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The tracked consumer owns nullable source/config; canonical producer and suite cache are not consumer cleanup targets. Error, signal and numeric nonzero status are checked before consuming output. Synchronous return does not certify arbitrary descendants, exact internal child argv or loaded-image equality.
 * @evidence contracts/e2e.md#preserved-coverage Original nonzero status and possibly-null diagnostic assertions remain; this connection does not claim to replace exact rule semantics units.
 */
export function test_plugin_corpus_ttsc_lint_applies_forwarded_strict_flag(): void {
  const root = setupLintProject("lint-violations");
  fs.writeFileSync(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: false,
        outDir: "dist",
        rootDir: "src",
        plugins: [{ transform: "@ttsc/lint" }],
      },
      include: ["src"],
    }),
  );
  fs.writeFileSync(
    path.join(root, "src", "main.ts"),
    `export const len = (x: string | null): number => x.length;\n`,
  );
  const cacheDir = SHARED_PLUGIN_CACHE_DIR;
  const result = spawn(ttscBin, ["--cwd", root, "--noEmit", "--strict"], {
    cwd: root,
    env: { PATH: goPath(), TTSC_CACHE_DIR: cacheDir },
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(typeof result.status, "number");
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /is possibly .?null/i);
}
