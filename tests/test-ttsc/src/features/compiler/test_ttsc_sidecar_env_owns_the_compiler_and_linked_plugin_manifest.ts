import assert from "node:assert/strict";
import os from "node:os";

import { BuildExecution } from "../../../../../packages/ttsc/lib/compiler/internal/build/BuildExecution.js";
import { inheritedSidecarEnv } from "../../../../../packages/ttsc/lib/compiler/internal/sharedHost/inheritedSidecarEnv.js";
import { publishLinkedTransformPlugins } from "../../../../../packages/ttsc/lib/compiler/internal/sharedHost/publishLinkedTransformPlugins.js";

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
 */
export const test_ttsc_sidecar_env_owns_the_compiler_and_linked_plugin_manifest =
  (): void => {
    const saved = {
      binary: process.env.TTSC_TSGO_BINARY,
      linked: process.env.TTSC_LINKED_PLUGINS_JSON,
    };
    process.env.TTSC_TSGO_BINARY = "/outer/tsgo";
    process.env.TTSC_LINKED_PLUGINS_JSON = "{not json";
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
        const env = BuildExecution.nativePluginEnv(
          undefined,
          execution,
          plugin(stage),
        );
        assert.equal(env.TTSC_TSGO_BINARY, "/selected/tsgo", stage);
        assert.equal(env.TTSC_LINKED_PLUGINS_JSON, undefined, stage);
      }
      const overridden = BuildExecution.nativePluginEnv(
        { TTSC_TSGO_BINARY: "/caller/tsgo" },
        execution,
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
    }
  };

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
