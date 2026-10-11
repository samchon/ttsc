import { TestUnpluginProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";

import { RuntimeLoaderCapabilities } from "../../../../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities.js";
import { createUtilityPluginProject } from "./createUtilityPluginProject";

/**
 * Whether this Node lets a utility config's resolutions be observed, verifying
 * the documented contract when it does not.
 *
 * Node 22's `require.resolve` bypasses the module hooks, so a config's
 * resolutions cannot be observed there (samchon/ttsc#1566). Output that rests
 * on unobserved inputs is refused to any host that is not explicitly
 * nonwatching, and only such a host, able to withdraw it, receives it fresh
 * (samchon/ttsc#1713). On that Node this checks both answers for a config that
 * requires its selection, then returns false so the caller skips the
 * invalidation cases its premise does not hold for.
 */
export async function utilityConfigResolutionsObservable(): Promise<boolean> {
  if (RuntimeLoaderCapabilities.requireResolveConsultsHooks()) return true;
  const { createTtscTransformCache, resolveOptions, transformTtsc } =
    await TestUnpluginRuntime.loadUnpluginApi();
  const root = createUtilityPluginProject({
    plugin: "banner",
    pluginEntry: { configFile: "./config/banner.config.cjs" },
    source: 'export const value: string = "kept";\n',
    files: {
      "config/selection.cjs":
        'module.exports = { text: "UNOBSERVED CONFIG SELECTION" };\n',
      "config/banner.config.cjs":
        'module.exports = require("./selection.cjs");\n',
    },
  });
  const file = TestUnpluginProject.mainFile(root);
  const source = TestUnpluginProject.mainSource(root);
  await assert.rejects(
    transformTtsc(
      file,
      source,
      resolveOptions(),
      undefined,
      createTtscTransformCache(),
    ),
    /plugin input observation is unavailable/,
    "a host that is not explicitly nonwatching must refuse unobserved output",
  );
  let withdrawn = 0;
  const fresh = await transformTtsc(
    file,
    source,
    resolveOptions(),
    undefined,
    createTtscTransformCache(),
    {
      watching: false,
      markVolatile: () => {
        ++withdrawn;
      },
    },
  );
  assert.ok(fresh, "an explicitly nonwatching host receives fresh output");
  assert.match(fresh.code, /UNOBSERVED CONFIG SELECTION/);
  assert.ok(withdrawn > 0, "the fresh output is withdrawn from the host cache");
  return false;
}
