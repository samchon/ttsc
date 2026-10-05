import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { createWatchInputUnitFixture } from "../../internal/transform-complete/createWatchInputUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyWatchInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyWatchInputs";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { createViteServeWatchHooks } from "../../../../../packages/unplugin/src/core/vite/createViteServeWatchHooks";
import type { ViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/ViteServeInputWatch";

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
 * @evidence contracts/testing.md#behavioral-verification Source notifyWatchInputs and notifyFailedGenerationInputs preserve configured/physical project spellings, while createViteServeWatchHooks forwards the exact compiler batch and mode discriminator. Source notifyWatchInputs must register only universal inputs without dependencies, graph a/b/ambient without self or unreachable edges, a deduplicated graph/dependency union, and the two original alias-dependent watch lists. The helper invokes the actual source owner with each delivered file. Two direct calls with Bun's callback-absent hook shape must return undefined without invoking markVolatile or altering the observed consumer baseline.
 * @evidence contracts/testing.md#independent-expectations Literal graph edges and dependencies reproduce the original E2E inputs; enumerated expected paths reproduce their five watch-list assertions. Real links establish equal physical files independently. Expected lists do not call the selector, traversal or normalization under test. Without a consuming module/project channel no handoff or refused-record volatility is owed; independent copies and native bytes check that both calls preserve their input.
 * @evidence contracts/testing.md#distinguishing-cases Transitive reach, a cycle back to the delivered module, an unreachable edge, overlapping globals/configs, graph/dependency overlap and exclusive inputs, duplicate relative and absolute dependencies, and aliased versus canonical deliveries retain their contrasting lists. Every graph/dependency envelope is independent; Repeated deliveries of one immutable dependency envelope each receive the exact universal and nearer-config/source watch tail. Alias deliveries share one immutable envelope to exercise its lexical memo keys. Callback-absent first/repeat calls contrast those consuming hosts while retaining relative/absolute/duplicate/self dependency metadata.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls notifyWatchInputs through createWatchInputUnitFixture and directly with an actual native-observed consumer baseline. It executes no native producer or process. test_transformttsc_composes_a_mixed_completeness_envelope_per_file retains actual native output, dependency/graph transport and one-capture assertions; test_transformttsc_forwards_plugin_dependencies_to_the_watch_hook retains native alias delivery. Prepared unit envelopes establish only watch-input selection and optional-channel rules, not Bun onLoad/parser, private cache lifetime or native capture. A native project directory link contrasts configured and physical callback spellings in healthy and failed handoffs. Actual createViteServeWatchHooks forwards a readonly compiler batch/token with the observer receiver, selects an empty watcherless shape or non-serve undefined, and propagates the exact callback failure without adding runtime or project channels. These factory facts do not certify installed Vite runtime imports or observer acquisition.
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
  check("Bun-shaped delivery without watch or project callbacks", () => {
    const tsconfig = path.join(root, "tsconfig.json");
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success",
      typescript: { "src/main.ts": "export const value = 1;\n" },
      hostInputs: ["tsconfig.json"],
      hostInputHashes: {
        [tsconfig]: createHash("sha256").update(fs.readFileSync(tsconfig)).digest("hex"),
      },
      hostInputRealpaths: { [tsconfig]: fs.realpathSync.native(tsconfig) },
      dependencies: {
        "src/main.ts": ["tsconfig.json", tsconfig, "tsconfig.json", "src/main.ts"],
      },
    };
    const cached = observeValidationUnitGeneration(root, result);
    const baseline = structuredClone(result);
    const inputHashes = { ...cached.inputHashes };
    const externalHashes = { ...cached.externalInputHashes };
    const sourceBytes = fs.readFileSync(file);
    const configBytes = fs.readFileSync(tsconfig);
    let volatileCalls = 0;
    const hooks = Object.freeze({
      exactPath: true,
      watching: false,
      markVolatile: () => { ++volatileCalls; },
    });
    const selection = {
      consulted: [],
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      tsconfig,
    };
    for (let delivery = 0; delivery < 2; ++delivery) {
      assert.equal(notifyWatchInputs(hooks, cached, file, selection), undefined);
      assert.equal(volatileCalls, 0, "no refused record asks for volatility");
      assert.equal(cached.result, result);
      assert.deepEqual(result, baseline);
      assert.deepEqual(cached.inputHashes, inputHashes);
      assert.deepEqual(cached.externalInputHashes, externalHashes);
      assert.deepEqual(fs.readFileSync(file), sourceBytes);
      assert.deepEqual(fs.readFileSync(tsconfig), configBytes);
    }
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
  check("configured project spelling in healthy and failed handoffs", () => {
    const linkedRoot = root + "-configured-project";
    fs.mkdirSync(path.dirname(linkedRoot), { recursive: true });
    fs.symlinkSync(root, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    fs.writeFileSync(path.join(root, "src", "types.d.ts"), "export declare const typed: number;\n");
    const tsconfig = path.join(linkedRoot, "tsconfig.json");
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success", typescript: { "src/main.ts": "export const value = 1;\n" },
      hostInputs: ["package.json", "plugin.cjs", "tsconfig.json"],
      dependencies: { "src/main.ts": ["src/types.d.ts"] },
    };
    const cached = {
      projectRoot: linkedRoot, tsconfig, result,
      membershipPolicy: readProjectMembershipPolicy(tsconfig),
      inputHashes: Object.fromEntries(["src/main.ts", "src/types.d.ts"].map((name) =>
        [name, createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest("hex")])),
    };
    const selection = { consulted: [], tsconfig, filesystem: DEFAULT_FILESYSTEM_OPERATIONS };
    try {
      assert.equal(fs.realpathSync.native(linkedRoot), fs.realpathSync.native(root));
      for (const spelling of [linkedRoot, fs.realpathSync.native(root)]) {
        const delivered = path.join(spelling, "src", "main.ts");
        const healthy: string[] = [];
        notifyWatchInputs({ addWatchFile: (input) => { healthy.push(input); } }, cached, delivered, selection);
        assert.deepEqual(healthy.sort(), ["package.json", "plugin.cjs", "tsconfig.json", "src/types.d.ts"].map((name) => path.join(spelling, name)).sort());
        const failed: string[] = [];
        notifyFailedGenerationInputs({ addWatchFiles: (inputs, failure) => {
          assert.equal(failure, true);
          failed.push(...inputs.map((input) => input.file));
        } }, cached, delivered, selection);
        assert.deepEqual(failed.sort(), ["src/main.ts", "src/types.d.ts", "tsconfig.json"].map((name) => path.join(spelling, name)).sort());
      }
    } finally {
      fs.rmSync(linkedRoot, { recursive: true, force: true });
    }
  });
  check("Vite compiler input channel stays separate from runtime hooks", () => {
    const calls: Parameters<ViteServeInputWatch["replace"]>[] = [];
    const serveInputs: Pick<ViteServeInputWatch, "replace"> = {
      replace(...args) {
        assert.equal(this, serveInputs);
        calls.push(args);
      },
    };
    const inputs = Object.freeze([Object.freeze({ file })]);
    const hooks = createViteServeWatchHooks("serve", true, serveInputs, file, 17)!;
    assert.deepEqual(Object.keys(hooks).sort(), ["addWatchFiles", "membership"]);
    assert.equal(hooks.membership, true);
    hooks.addWatchFiles!(inputs, true);
    hooks.addWatchFiles!(inputs, undefined);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], [file, inputs, true, 17]);
    assert.deepEqual(calls[1], [file, inputs, undefined, 17]);
    assert.equal(calls[0]![1], inputs, "the readonly batch is forwarded without copying or rewriting");
    assert.deepEqual(createViteServeWatchHooks("serve", false, serveInputs, file, undefined), {});
    assert.equal(createViteServeWatchHooks("build", true, serveInputs, file, undefined), undefined);
    assert.equal(createViteServeWatchHooks(undefined, true, serveInputs, file, undefined), undefined);
    const failure = new Error("authored compiler-input channel failure");
    serveInputs.replace = function () { assert.equal(this, serveInputs); throw failure; };
    assert.throws(() => hooks.addWatchFiles!(inputs, false), (error) => error === failure);
    assert.equal(calls.length, 2);
  });
  if (errors.length !== 0)
    throw new AggregateError(errors, "watch-input graph/dependency matrix");
}
