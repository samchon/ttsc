import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";

/**
 * Verifies graph reach, reported dependencies and lexical module exclusions
 * through the source watch-input owner.
 *
 * The same small consumer supplies four independently authored envelopes. Real
 * directory links distinguish aliases of one physical file without starting a
 * compiler, producer, watcher or product host.
 *
 * 1. Compare universal-only inputs, transitive graph reach and the union of
 *    overlapping graph and reported dependencies against literal path lists.
 * 2. Deliver one dependency envelope through a directory alias and through its
 *    canonical spelling, preserving each other independently retargetable
 *    spelling while excluding only the delivered one.
 * 3. Collect every independent list failure before reporting the matrix.
 *
 * @evidence contracts/testing.md#behavioral-verification Source notifyWatchInputs must register only universal inputs without dependencies, graph a/b/ambient without self or unreachable edges, a deduplicated graph/dependency union, and the two original alias-dependent watch lists. The helper invokes the actual source owner with each delivered file.
 * @evidence contracts/testing.md#independent-expectations Literal graph edges and dependencies reproduce the original E2E inputs; enumerated expected paths reproduce their five watch-list assertions. Real links establish equal physical files independently. Expected lists do not call the selector, traversal or normalization under test.
 * @evidence contracts/testing.md#distinguishing-cases Transitive reach, a cycle back to the delivered module, an unreachable edge, overlapping globals/configs, graph/dependency overlap and exclusive inputs, duplicate relative and absolute dependencies, and aliased versus canonical deliveries retain their contrasting lists. Every graph/dependency envelope is independent; Repeated deliveries of one immutable dependency envelope each receive the exact universal and nearer-config/source watch tail. Alias deliveries share one immutable envelope to exercise its lexical memo keys.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls notifyWatchInputs through createWatchInputUnitFixture, which reads a real temporary membership config. It executes no native producer or process. test_transformttsc_composes_a_mixed_completeness_envelope_per_file retains actual native output, dependency/graph transport and one-capture assertions; test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook retains native alias delivery. Prepared unit envelopes establish only the watch-input selection rules.
 */
export function test_watch_inputs_preserve_graph_dependency_and_alias_rules(): void {
  const fixture = createWatchInputUnitFixture();
  const root = fixture.root;
  const file = path.join(root, "src", "main.ts");
  const errors: Error[] = [];
  const check = (label: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      errors.push(new Error(label, { cause: error }));
    }
  };
  const base: ITtscCompilerTransformation.ISuccess = {
    type: "success",
    typescript: { "src/main.ts": "export const value = 1;\n" },
    hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
    pluginSources: {
      [path.join(root, "plugin-source")]: "unit-input-state",
    },
  };
  check("no reported dependencies", () =>
    assert.deepEqual(fixture.collect({ ...base }), fixture.universal.sort()),
  );
  check("repeat handoff for the same recorded dependency envelope", () => {
    const recorded: ITtscCompilerTransformation.ISuccess = {
      ...base,
      dependencies: { "src/main.ts": ["src/types.d.ts"] },
    };
    const expected = [path.join(root, "src", "types.d.ts"), ...fixture.universal].sort();
    assert.deepEqual(fixture.collect(recorded), expected);
    assert.deepEqual(fixture.collect(recorded), expected, "cache replay must not suppress a new host's watch handoff");
  });
  check("graph reach, globals and configs", () =>
    assert.deepEqual(
      fixture.collect({
        ...base,
        graph: {
          edges: {
            "src/main.ts": ["src/a.d.ts"],
            "src/a.d.ts": ["src/b.d.ts", "src/main.ts"],
            "src/other.ts": ["src/unrelated.d.ts"],
          },
          globals: ["src/ambient.d.ts", "src/main.ts"],
          configs: ["tsconfig.json"],
        },
      }),
      [
        path.join(root, "src", "a.d.ts"),
        path.join(root, "src", "b.d.ts"),
        path.join(root, "src", "ambient.d.ts"),
        ...fixture.universal,
      ].sort(),
    ),
  );
  check("graph and dependency union", () =>
    assert.deepEqual(
      fixture.collect({
        ...base,
        dependencies: {
          "src/main.ts": ["src/shared.d.ts", "src/only-dependency.d.ts"],
        },
        graph: {
          edges: { "src/main.ts": ["src/shared.d.ts", "src/only-graph.d.ts"] },
          globals: [],
          configs: [],
        },
      }),
      [
        path.join(root, "src", "shared.d.ts"),
        path.join(root, "src", "only-dependency.d.ts"),
        path.join(root, "src", "only-graph.d.ts"),
        ...fixture.universal,
      ].sort(),
    ),
  );
  check("dependency aliases", () => {
    const absolute = path.join(root, "src", "absolute-types.d.ts");
    const firstAlias = path.join(root, "first-source-alias");
    const secondAlias = path.join(root, "second-source-alias");
    for (const alias of [firstAlias, secondAlias])
      fs.symlinkSync(
        path.join(root, "src"),
        alias,
        process.platform === "win32" ? "junction" : "dir",
      );
    const firstAliasedMain = path.join(firstAlias, "main.ts");
    const secondAliasedMain = path.join(secondAlias, "main.ts");
    const result: ITtscCompilerTransformation.ISuccess = {
      ...base,
      dependencies: {
        "src/main.ts": [
          "src/types.d.ts",
          absolute,
          "src/types.d.ts",
          "src/main.ts",
          path.relative(root, firstAliasedMain),
          path.relative(root, secondAliasedMain),
          path.relative(root, firstAliasedMain),
        ],
      },
    };
    check("aliased dependency delivery", () =>
      assert.deepEqual(
        fixture.collect(result, firstAliasedMain),
        [
          path.join(root, "src", "types.d.ts"),
          absolute,
          file,
          secondAliasedMain,
          ...fixture.universal.filter(
            (input) => input !== path.join(root, "src", "tsconfig.json"),
          ),
          path.join(firstAlias, "tsconfig.json"),
        ].sort(),
      ),
    );
    check("canonical dependency delivery", () =>
      assert.deepEqual(
        fixture.collect(result),
        [
          path.join(root, "src", "types.d.ts"),
          absolute,
          firstAliasedMain,
          secondAliasedMain,
          ...fixture.universal,
        ].sort(),
      ),
    );
  });
  if (errors.length !== 0)
    throw new AggregateError(errors, "watch-input graph/dependency matrix");
}
