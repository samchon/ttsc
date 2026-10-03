import { SHARED_PLUGIN_CACHE_DIR } from "../../../../internal/ttsc/internal/plugin-cache";
import {
  assert,
  nativePluginSource,
  fs,
  goPath,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../../internal/ttsc/internal/plugin-corpus";

/**
 * Verifies plugin corpus: a composed plugin inherits the aggregate's
 * `contributors`.
 *
 * Regression lock for `loadProjectPlugins.ts::composePluginSources` (issue
 * #101). A composed plugin is rerouted to the aggregate's `source`; it must
 * ALSO inherit the aggregate's `contributors`, because `buildSourcePlugin` keys
 * its native-binary cache on `source` + `contributors`. Without the inheritance
 * the aggregate record (with contributors) and the composed record (without)
 * resolve to two divergent binaries, and ttsc aborts with "multiple compiler
 * native backends cannot share one emit pass". The separate guard that rejects
 * a composed plugin declaring its OWN `contributors` is unaffected — "inherits
 * the aggregate's" and "may not declare its own" are not in conflict.
 *
 * 1. Materialize an aggregate plugin that both `composes` a target transform and
 *    declares a `contributors` entry, plus the redirected target whose own
 *    `source` points at a missing directory.
 * 2. Run `ttsc --emit`.
 * 3. Assert a zero exit (compatible aggregate/target emit admission)
 *    and that the target's suffix transform still reached the emitted
 *    JavaScript.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes the real CLI with a contributor-bearing aggregate and a target whose own source does not exist; requires compatible emit admission and the target's literal PLUGIN:Z emission.
 * @evidence contracts/testing.md#independent-expectations Literal missing-target source, suffix Z and emitted PLUGIN:Z define the oracle; test_plugin_composition_preserves_one_hop_host_identity_and_rejections directly asserts descriptor redirect, shared contributor/capability objects and rejection messages; this is separate from current execution evidence.
 * @evidence contracts/testing.md#distinguishing-cases Retains the strongest real composition assembly case, combining source redirect with contributor-derived binary identity and target config propagation; the exact direct one-hop/cycle owner is tests/test-ttsc/src/features/compiler/test_plugin_composition_preserves_one_hop_host_identity_and_rejections.ts under the ordinary source-unit runner, with runtime unverified here.
 * @evidence contracts/testing.md#execution-ownership This named native export owns one consumer project and one CLI compilation, selected once by the native boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor units cannot prove real native assembly admits this aggregate/target configuration and forwards suffix JSON into emission. This invocation asserts status zero and PLUGIN:Z; it does not directly count hosts or compare their binary bytes.
 * @evidence contracts/e2e.md#shared-execution Uses the canonical immutable transformer source and shared TTSC_CACHE_DIR; the consumer owns its contributor bytes. Their changed input justifies separate resolution identity, but this case does not measure builds, cache hits or total host/Program counts. Direct-owner existence does not authorize further meaningful donor removal before actual surviving execution.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The canonical Go module is never mutated, and the contributor's exact temporary physical source/content identity remains in the production cache key; the authored missing target contrasts with the successful emitted marker. Producer-source inputs remain fixed, but cache key presence does not certify loaded-image identity. The synchronous launcher result and TestProject cleanup do not certify arbitrary descendant termination.
 * @evidence contracts/e2e.md#preserved-coverage Keeps original CLI success and PLUGIN:Z emission, also owning the former plain-redirect success; the named direct composition source unit authors the original nontransitive A/A/B distinction and reciprocal-cycle failure, and the existing fake-name shared-host boundary retains the separate multi-backend rejection obligation, with current runtime unverified.
 */
export function test_plugin_corpus_composes_inherits_aggregate_contributors(): void {
    const root = pluginProject(
      [
        { transform: "./plugins/aggregate.cjs" },
        { transform: "./plugins/target.cjs", suffix: ":Z" },
      ],
      {
        "plugins/aggregate.cjs": `module.exports = (context) => ({
  name: "compose-aggregate",
  source: ${JSON.stringify(nativePluginSource())},
  composes: ["compose-target"],
  contributors: [
    {
      name: "demo",
      source: require("node:path").resolve(context.dirname, "contributor"),
    },
  ],
});\n`,
        "plugins/target.cjs": `module.exports = (context) => ({
  name: "compose-target",
  source: require("node:path").resolve(context.dirname, "missing-go-target"),
});\n`,
        "plugins/contributor/contributor.go": "package demo\n",
      },
    );
    const result = spawn(ttscBin, ["--cwd", root, "--emit"], {
      cwd: root,
      env: { PATH: goPath(), TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR },
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null, result.stderr || result.stdout);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN:Z"/,
    );
}
