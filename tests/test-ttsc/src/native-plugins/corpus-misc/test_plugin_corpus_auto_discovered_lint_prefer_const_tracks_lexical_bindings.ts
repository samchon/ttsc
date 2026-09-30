import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";
import {
  assert,
  goPath,
  fs,
  parseDiagnostics,
  parseExpectations,
  path,
  setupLintProject,
  spawn,
  ttscBin,
} from "../../internal/plugin-corpus";

/**
 * Verifies auto-discovered lint prefer-const tracks lexical bindings.
 *
 * The issue reproduction intentionally has no tsconfig `plugins` entry. The
 * package-level auto-plugin path must still run the native rule and produce the
 * three ESLint-default findings without suppressing same-spelled siblings.
 *
 * 1. Copy the strict NodeNext fixture with @ttsc/lint as a dev dependency.
 * 2. Run the real ttsc CLI with no explicit transform plugin configuration.
 * 3. Compare all prefer-const diagnostics with the annotated three findings.
 *
 * @evidence contracts/testing.md#behavioral-verification Executes package-marker auto-discovery through ttsc, requiring exit 2, the fixture's exact three prefer-const rule/severity/line findings and one no-unused-expressions transport marker, rendered TS17397/TS17505 codes and the original unknown-rule warning; an undiscovered package, lost native findings or wrong renderer code fails.
 * @evidence contracts/testing.md#independent-expectations Authored expectation annotations and the public lint process error/code contract establish literal expected findings independently of native rule execution.
 * @evidence contracts/testing.md#distinguishing-cases The real transport carries positive findings while a reassigned same-spelled sibling stays clean. Full no-misused-promises, no-unsafe-assignment, no-unused-expressions/TSX and lexical-control decision matrices execute in their migrated Go rule units.
 * @evidence contracts/testing.md#execution-ownership The named test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings entry remains under native-plugins/corpus-misc and owns generic no-plugin package-marker loading, native transport and CLI error rendering for the migrated auto-discovery population; exact rule semantics execute in the shared Go unit process.
 * @evidence contracts/e2e.md#necessary-boundary A package.json dependency and its ttsc plugin marker must load the actual lint source without an explicit tsconfig entry, deliver its findings through native stderr and produce the CLI error exit. Owning rule calls cannot prove that connection.
 * @evidence contracts/e2e.md#shared-execution One consumer project, one launcher invocation and the canonical captured authored lint producer with SHARED_PLUGIN_CACHE_DIR own the migrated population's generic auto-discovery boundary; exact rule/input variations use one Go unit process.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The temporary consumer contains immutable copied source expectations and a once-captured authored package link. The package snapshot manifest and copied bytes are independently checked before reuse. No contributor/source/cache mutation occurs, so the exact native lint build identity can be reused; TestProject cleans the consumer at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Keeps exact native rule/severity/line rendering plus exit and TS17505 mapping here. Migrated Go owners preserve no_misused_promises six default contexts and controls, no_unsafe_assignment seven sites and unknown control, prefer_const three lexical findings, and no_unused_expressions two findings plus directives and default JSX; the original three redundant E2E invocations are removed after those units actually passed. TestAwaitThenablePreservesMigratedAllFamilyContexts, TestBanTsCommentPreservesMigratedDefaultsAndOptions, TestPreferAsConstPreservesMigratedAllFamilyContexts and TestNoFloatingPromisesPreservesMigratedDefaultContexts additionally preserve the original lint-family source/compiler settings, scalar or tuple options and complete rule/severity/line sets. TestSwitchExhaustivenessCheckPreservesMigratedDefaultsAndOptions additionally owns the original two sources, NodeNext settings, simultaneous four-option tuple, five and three findings, exact message populations and positive/negative codeframes. TestCommandCheckCorpusCleanProjectExitsZero owns the original clean source, eight-rule configuration and zero status/output, with actual native success retained in the formatter survivor. TestCommandCheckCorpusIgnoresFutureOptionalFlags owns the original source/config/unknown argv and direct command status/output. This invocation retains their generic actual loader/binary and package-marker transport admission, without claiming to execute those migrated sources or optional flag through the launcher. TestCommandCheckCorpusReportsUnknownRuleNames preserves the original warning/status/source semantics, while this invocation keeps the original unknown-rule native warning-forwarding assertion.
 */
export function test_plugin_corpus_auto_discovered_lint_prefer_const_tracks_lexical_bindings() {
    const root = setupLintProject("lint-prefer-const-lexical", { nativeProducer: "snapshot" });
    const source = path.join(root, "src", "case.ts");
    const unusedSource = path.join(root, "src", "unused.ts");
    fs.writeFileSync(unusedSource, "declare const tag: (strings: TemplateStringsArray) => string;\n// expect: no-unused-expressions error\ntag`value`;\n");
    fs.writeFileSync(path.join(root, "lint.config.json"), JSON.stringify({ rules: { "prefer-const": "error", "no-unused-expressions": "error", "made-up-rule": "error" } }));
    const configPath = path.join(root, "tsconfig.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    config.files.push("src/unused.ts");
    fs.writeFileSync(configPath, JSON.stringify(config));

    const result = spawn(ttscBin, ["--cwd", root, "--noEmit"], {
      cwd: root,
      env: {
        PATH: goPath(),
        TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
      },
    });

    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stderr, /ignoring unknown rule "made-up-rule"/);
    assert.deepEqual(
      parseDiagnostics(result.stderr, source),
      parseExpectations(source),
      result.stderr,
    );
    assert.deepEqual(parseDiagnostics(result.stderr, unusedSource), parseExpectations(unusedSource), result.stderr);
    assert.deepEqual([...result.stderr.matchAll(/\bTS(\d+):/g)].map((match) => match[1]).sort(), ["17397", "17397", "17397", "17505"], result.stderr);
}
