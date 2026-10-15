import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { inheritedSidecarEnv } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/inheritedSidecarEnv";
import { publishLinkedTransformPlugins } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/publishLinkedTransformPlugins";

/**
 * Verifies a sidecar environment carries this invocation's compiler and linked
 * plugins and content-identity scratch root, never an outer ttsc run's.
 *
 * Every sidecar env starts from `process.env`. The child constructors gave an
 * inherited `TTSC_TSGO_BINARY` priority over the compiler the invocation
 * resolved, although `resolveTsgo` ranks an explicit binary first, so a parent
 * compiling with B handed its hosts A. They also set `TTSC_LINKED_PLUGINS_JSON`
 * only when this invocation linked plugins, so a nested build with none
 * inherited the outer manifest, and the Go host ran plugins it never chose or
 * failed parsing a payload it did not own.
 *
 * 1. Put an outer compiler and invalid linked manifest in `process.env`, then
 *    supply a stale record root in the composer input.
 * 2. Build a check-host env, a transform-host env with no linked plugins, and a
 *    descriptor-evaluation env with an explicit compiler.
 * 3. Assert each carries the resolved compiler and no inherited manifest or record
 *    root, while a caller-named manifest, opened record store and this
 *    invocation's linked list survive.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls composeNativePluginEnv, inheritedSidecarEnv and publishLinkedTransformPlugins with an outer compiler, stale record root and invalid manifest, asserting exact selected compiler, removed inherited payload and retained caller/own store and linked-plugin contents.
 * @evidence contracts/testing.md#independent-expectations Literal outer, selected, caller and descriptor compiler identities establish invocation precedence independently of composition. The explicit authored plugin DTO establishes the linked list without reading it back as an expected result.
 * @evidence contracts/testing.md#distinguishing-cases Check and transform stages both reject stale inherited state; absent versus opened record store clears or replaces the inherited root. Caller compiler loses to selected compiler, explicit descriptor wins while absent descriptor selection preserves its inherited override, and caller-empty versus invocation-owned linked payloads remain distinct. A selected Node binary also overrides the outer binary without discovery.
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
      const projectRoot = os.tmpdir();
      const tsconfig = path.join(projectRoot, "tsconfig.json");
      const project = {
        configPaths: [tsconfig],
        compilerOptions: { plugins: [] },
        identity: {
          invocationCwd: projectRoot,
          logicalConfigPath: tsconfig,
          logicalProjectRoot: projectRoot,
          physicalConfigPath: tsconfig,
          physicalProjectRoot: projectRoot,
        },
        path: tsconfig,
        pluginBaseDirs: [],
        root: projectRoot,
      };
      const execution: Parameters<
        typeof BuildExecution.composeNativePluginEnv
      >[2] = {
        compilerSelection: {
          args: [],
          passthrough: [],
          compilerArgsCwd: projectRoot,
          inspectionError: undefined,
          inspectedArgs: [],
          observations: new Map(),
          project,
          projectGuard: [],
        },
        cwd: projectRoot,
        nativePlugins: [],
        pluginConfigDir: undefined,
        pluginSetupFailure: undefined,
        project,
        projectNoEmit: false,
        projectRoot,
        rewriteRelativeImportExtensionsForEmit: false,
        tsgo: {
          binary: "/selected/tsgo",
          packageJson: "",
          packageRoot: "/selected",
          version: "custom",
        },
        tsconfig,
      };
      const plugin = (
        stage: "check" | "transform",
      ): NonNullable<
        Parameters<typeof BuildExecution.composeNativePluginEnv>[4]
      > => ({
        binary: "/selected/host",
        config: {},
        kind: "executable",
        source: "/selected/source",
        stage,
      });

      for (const stage of ["check", "transform"] as const) {
        const env = BuildExecution.composeNativePluginEnv(
          SidecarEnvironment.merge(process.env, {
            TTSC_NATIVE_PLUGIN_RECORD_ROOT: "/outer/cache",
          }),
          undefined,
          execution,
          "/selected/node",
          plugin(stage),
        );
        assert.equal(env.TTSC_TSGO_BINARY, "/selected/tsgo", stage);
        assert.equal(env.TTSC_LINKED_PLUGINS_JSON, undefined, stage);
        assert.equal(env.TTSC_NATIVE_PLUGIN_RECORD_ROOT, undefined, stage);
        assert.equal(env.TTSC_NODE_BINARY, "/selected/node", stage);
      }
      const withStore = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, {
          TTSC_NATIVE_PLUGIN_RECORD_ROOT: "/outer/cache",
        }),
        undefined,
        {
          ...execution,
          identities: {
            root: "/selected/cache",
            references: new Map<bigint, bigint>(),
            version: "test",
          },
        },
        "/selected/node",
        plugin("check"),
      );
      assert.equal(withStore.TTSC_NATIVE_PLUGIN_RECORD_ROOT, "/selected/cache");
      const overridden = BuildExecution.composeNativePluginEnv(
        SidecarEnvironment.merge(process.env, {
          TTSC_TSGO_BINARY: "/caller/tsgo",
        }),
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
        {
          binary: "/selected/linked-host",
          source: "/selected/linked-source",
          kind: "linked",
          config: { transform: "x" },
          name: "linked",
          stage: "transform",
        },
      ]);
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
