import assert from "node:assert/strict";
import os from "node:os";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { inheritedSidecarEnv } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/inheritedSidecarEnv";
import { publishLinkedTransformPlugins } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/publishLinkedTransformPlugins";
import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";

/**
 * Verifies a sidecar environment carries this invocation's compiler and linked
 * plugins, never an outer ttsc run's.
 *
 * Every sidecar env starts from `process.env`. The child constructors gave an
 * inherited `TTSC_TSGO_BINARY` priority over the compiler the invocation
 * resolved, although `resolveTsgo` ranks an explicit binary first, so a parent
 * compiling with B handed its hosts A. They also set `TTSC_LINKED_PLUGINS_JSON`
 * only when this invocation linked plugins, so a nested build with none
 * inherited the outer manifest, and the Go host ran plugins it never chose or
 * failed parsing a payload it did not own.
 *
 * 1. Put an outer compiler and an invalid linked manifest in `process.env`.
 * 2. Build a check-host env, a transform-host env with no linked plugins, and a
 *    descriptor-evaluation env with an explicit compiler.
 * 3. Assert each carries the resolved compiler and no inherited manifest, while a
 *    caller-named manifest and this invocation's own linked list survive.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls composeNativePluginEnv, inheritedSidecarEnv and publishLinkedTransformPlugins with an outer compiler and invalid manifest, asserting exact selected compiler, removed inherited payload and retained caller/own linked-plugin contents.
 * @evidence contracts/testing.md#independent-expectations Literal outer, selected, caller and descriptor compiler identities establish invocation precedence independently of composition. The explicit authored plugin DTO establishes the linked list without reading it back as an expected result.
 * @evidence contracts/testing.md#distinguishing-cases Check and transform stages both reject stale inherited state; caller compiler loses to selected compiler, explicit descriptor wins while absent descriptor selection preserves its inherited override, and caller-empty versus invocation-owned linked payloads remain distinct. A selected Node binary also overrides the outer binary without discovery.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the real pure composer with already-layered environment and selected Node identity in its Node process. Production nativePluginEnv still owns executable runtime discovery; this case starts no subprocess, installs no consumer and restores each inherited environment mutation in finally.
 */
export const test_ttsc_sidecar_env_owns_the_compiler_and_linked_plugin_manifest =
  (): void => {
    const saved = {
      binary: process.env.TTSC_TSGO_BINARY,
      linked: process.env.TTSC_LINKED_PLUGINS_JSON,
      node: process.env.TTSC_NODE_BINARY,
    };
    process.env.TTSC_TSGO_BINARY = "/outer/tsgo";
    process.env.TTSC_LINKED_PLUGINS_JSON = "{not json";
    process.env.TTSC_NODE_BINARY = "/outer/node";
    try {
      const execution = {
        nativePlugins: [],
        pluginConfigDir: undefined,
        projectRoot: os.tmpdir(),
        tsgo: { binary: "/selected/tsgo" },
      } as unknown as Parameters<typeof BuildExecution.nativePluginEnv>[1];
      const plugin = (stage: "check" | "transform") =>
        ({ stage }) as Parameters<typeof BuildExecution.nativePluginEnv>[2];

      for (const stage of ["check", "transform"] as const) {
        const env = BuildExecution.composeNativePluginEnv(
          SidecarEnvironment.merge(process.env),
          undefined,
          execution,
          "/selected/node",
          plugin(stage),
        );
        assert.equal(env.TTSC_TSGO_BINARY, "/selected/tsgo", stage);
        assert.equal(env.TTSC_LINKED_PLUGINS_JSON, undefined, stage);
        assert.equal(env.TTSC_NODE_BINARY, "/selected/node", stage);
      }
      const overridden = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, { TTSC_TSGO_BINARY: "/caller/tsgo" }),
        { TTSC_TSGO_BINARY: "/caller/tsgo" },
        execution,
        "/selected/node",
        plugin("check"),
      );
      assert.equal(overridden.TTSC_TSGO_BINARY, "/selected/tsgo");

      const descriptor = inheritedSidecarEnv(undefined, "/explicit/tsgo");
      assert.equal(descriptor.TTSC_TSGO_BINARY, "/explicit/tsgo");
      assert.equal(descriptor.TTSC_LINKED_PLUGINS_JSON, undefined);
      assert.equal(
        inheritedSidecarEnv(undefined).TTSC_TSGO_BINARY,
        "/outer/tsgo",
        "with no explicit compiler the inherited override still applies",
      );

      const named: NodeJS.ProcessEnv = { TTSC_LINKED_PLUGINS_JSON: "[]" };
      publishLinkedTransformPlugins(
        named,
        { TTSC_LINKED_PLUGINS_JSON: "[]" },
        [],
      );
      assert.equal(named.TTSC_LINKED_PLUGINS_JSON, "[]");

      const own: NodeJS.ProcessEnv = { TTSC_LINKED_PLUGINS_JSON: "{not json" };
      publishLinkedTransformPlugins(own, undefined, [
        { config: { transform: "x" }, name: "linked", stage: "transform" },
      ] as never);
      assert.deepEqual(JSON.parse(own.TTSC_LINKED_PLUGINS_JSON!), [
        { config: { transform: "x" }, name: "linked", stage: "transform" },
      ]);
    } finally {
      restore("TTSC_TSGO_BINARY", saved.binary);
      restore("TTSC_LINKED_PLUGINS_JSON", saved.linked);
      restore("TTSC_NODE_BINARY", saved.node);
    }
  };

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
