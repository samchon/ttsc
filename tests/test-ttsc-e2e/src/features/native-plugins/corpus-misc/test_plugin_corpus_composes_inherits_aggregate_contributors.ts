import { SHARED_PLUGIN_CACHE_DIR } from "../../../internal/plugin-cache";
import {
  assert,
  nativePluginSource,
  fs,
  goPath,
  path,
  pluginProject,
  spawn,
  ttscBin,
} from "../../../internal/plugin-corpus";

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
 * 3. Assert a zero exit (the composed and aggregate records share one native host)
 *    and that the target's suffix transform still reached the emitted
 *    JavaScript.
 *
 * @evidence contracts/testing.md#behavioral-verification Invokes the real CLI with a contributor-bearing aggregate and a target whose own source does not exist; requires shared native-host success and the target's literal PLUGIN:Z emission.
 * @evidence contracts/testing.md#independent-expectations Literal missing-target source, suffix Z and emitted PLUGIN:Z define the oracle; source units independently assert the descriptor redirect, contributor/capability inheritance and rejection decisions.
 * @evidence contracts/testing.md#distinguishing-cases Retains the strongest real composition assembly case, combining source redirect with contributor-derived binary identity and target config propagation; cycle and one-hop counterexamples remain exact source units.
 * @evidence contracts/testing.md#execution-ownership This named native export owns one consumer project and one CLI compilation, selected once by the native boundary runner.
 * @evidence contracts/e2e.md#necessary-boundary Descriptor units cannot prove both aggregate and target resolve to the same linked native binary and that target plugin JSON reaches its suffix handler; this case executes those real connections.
 * @evidence contracts/e2e.md#shared-execution Uses the canonical immutable transformer source and shared TTSC_CACHE_DIR; the one consumer-owned contributor source is built once for this distinct identity, replacing three redundant composition CLI cases with owning units.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The canonical Go module is never mutated, and the contributor's exact temporary physical source/content identity remains in the production cache key; missing target resolution can succeed only after the actual redirect.
 * @evidence contracts/e2e.md#preserved-coverage Keeps original CLI success and PLUGIN:Z emission, also owning the former plain-redirect success; direct composePluginSources units retain the original nontransitive A/A/B distinction and reciprocal-cycle failure, and the fake-name shared-host E2E retains real multi-backend rejection.
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
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /"PLUGIN:Z"/,
    );
}
