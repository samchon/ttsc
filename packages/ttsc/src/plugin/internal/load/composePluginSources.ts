import type { ITtscPlugin } from "../../../structures/ITtscPlugin";
import type { ITtscProjectPluginConfig } from "../../../structures/ITtscProjectPluginConfig";
import type { ProjectPluginEntries } from "./ProjectPluginEntries";

/**
 * Resolve descriptor composition from the original ordered plugin records.
 *
 * One-hop redirects inherit source, contributors and host capabilities from
 * their aggregate without cascading through another redirected descriptor.
 * Conflicting aggregates, reciprocal cycles and target-owned contributors are
 * rejected before any Go producer is built. Input records are not mutated.
 *
 * @evidence contracts/common.md#principled-implementation Uses original descriptor identities for every alias edge, detects reciprocal cycles and conflicting owners, and copies only the selected aggregate host fields; nontransitive composition cannot read a previously redirected answer.
 * @evidence contracts/common.md#clear-and-simple-design Pure composition owns redirects while descriptor evaluation and native compilation remain in loadProjectPlugins; the private matcher compares only exact declared name or transform specifier.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No plugin-name exception or guessed source identity permits a redirect; incompatible target contributors and ambiguous aggregate owners fail with their existing diagnostics.
 * @evidence contracts/common.md#meaningful-documentation Native prose states one-hop inheritance, original-record lookup, nonmutation and rejection before native build; inline comments explain contributor and capability ownership.
 * @evidence contracts/performance.md#efficient-algorithms For n plugins and a aggregate descriptors, cycle detection costs O(a squared times the maximum alias count) and redirect selection costs O(n times a times the maximum alias count); aliases are matched by direct scans rather than an index, which suits the small descriptor populations of one project.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Composition uses this invocation's original descriptors and entry aliases; it owns no completed-answer cache or cross-request sharing.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Temporary aggregate and result arrays are invocation-owned; no retained history or live handle is acquired.
 */
export function composePluginSources(
  entries: readonly ProjectPluginEntries.ProjectPluginEntry[],
  plugins: readonly ITtscPlugin[],
): ITtscPlugin[] {
  const aggregates = plugins
    .map((plugin, index) => ({ index, plugin }))
    .filter(({ plugin }) => Array.isArray(plugin.composes));
  if (aggregates.length === 0) {
    return [...plugins];
  }
  for (const { plugin } of aggregates) {
    for (const target of plugin.composes!) {
      if (typeof target !== "string" || target.trim() === "") {
        throw new Error(
          `ttsc: plugin "${plugin.name}" has an invalid "composes" target; ` +
            `targets must be non-empty plugin names or transform specifiers`,
        );
      }
    }
  }
  // Composition is intentionally one hop only: A.composes=[B] sends B to A's
  // binary, but if B.composes=[C] then C uses B's original source and does NOT
  // cascade to A. Detect cycles (A.composes=[B] && B.composes=[A]) and throw,
  // otherwise the silent reswap below would mis-route both plugins.
  for (const { index: i, plugin: a } of aggregates) {
    for (const { index: j, plugin: b } of aggregates) {
      if (i === j) continue;
      const aTransform = entries[i]?.config.transform;
      const bTransform = entries[j]?.config.transform;
      const aComposesB = a.composes!.some((alias) =>
        matchesPluginAlias(alias, b, bTransform),
      );
      const bComposesA = b.composes!.some((alias) =>
        matchesPluginAlias(alias, a, aTransform),
      );
      if (aComposesB && bComposesA) {
        throw new Error(
          `ttsc: plugin composes cycle detected between "${a.name}" and "${b.name}"; ` +
            `each plugin lists the other in its "composes" array — composition is one hop only, not transitive`,
        );
      }
    }
  }
  return plugins.map((plugin, index) => {
    const transform = entries[index]?.config.transform;
    const matchingAggregates = aggregates.filter(
      ({ index: aggregateIndex, plugin: aggregatePlugin }) =>
        aggregateIndex !== index &&
        aggregatePlugin.composes!.some((alias) =>
          matchesPluginAlias(alias, plugin, transform),
        ),
    );
    if (matchingAggregates.length > 1) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" is composed by multiple aggregate plugins; ` +
          `each plugin entry can be redirected to only one aggregate native host`,
      );
    }
    const aggregate = matchingAggregates[0];
    if (aggregate === undefined) {
      return plugin;
    }
    // A composed plugin's source is rerouted to the aggregate's binary,
    // so its own `contributors` would link into a different host than
    // it was authored against. The "one binary" guarantee in the
    // protocol doc holds only when the composed plugin defers entirely
    // to the aggregate; reject early instead of silently producing two
    // diverging binaries.
    if (plugin.contributors && plugin.contributors.length > 0) {
      throw new Error(
        `ttsc: plugin "${plugin.name}" is composed by "${aggregate.plugin.name}" but declares its own "contributors"; ` +
          `move the contributors onto the aggregate plugin or drop the composes redirect`,
      );
    }
    return {
      ...plugin,
      source: aggregate.plugin.source,
      contributors: aggregate.plugin.contributors,
      // The composed plugin's runtime BINARY is the aggregate's binary,
      // so the CLI surface (which flags the sidecar parses) is the
      // aggregate's. Inherit `capabilities` from the aggregate so a
      // capability the aggregate declares — e.g. threadingArgs — does
      // not get silently dropped just because the composed entry's own
      // descriptor omitted it. An absent aggregate declaration is also its
      // own CLI contract; a redirected library cannot certify the new host.
      capabilities: aggregate.plugin.capabilities,
    };
  });
}

function matchesPluginAlias(
  alias: string,
  plugin: ITtscPlugin,
  transform: ITtscProjectPluginConfig["transform"],
): boolean {
  return (
    alias === plugin.name ||
    (typeof transform === "string" && alias === transform)
  );
}
