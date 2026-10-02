import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Verifies `extraCompilerOptions.plugins` interacts with the typia entry the
 * way the option documents: the service appends the typia entry after the
 * site's plugins, it appears once and never twice, and a site's own plugins
 * survive whether typia is on or off.
 *
 * The option says the typia plugin entry is added automatically when typia is
 * enabled and sites should not include it. A site that includes it anyway must
 * not produce a duplicated transform, and a disabled typia must not erase the
 * site's own plugin list.
 *
 * 1. Enable typia with a site plugin alone, then with extra plugins that already
 *    contain the typia transform and an unrelated plugin, and read the tsconfig
 *    written for compile and bundle.
 * 2. Disable typia with the same extra plugins and read the tsconfig again.
 * 3. Enable typia with no extra plugins as the baseline.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles through createWorkerCompilerService and parses the tsconfig text it writes, comparing the complete compilerOptions.plugins value for each typia and extra-plugin combination.
 * @evidence contracts/testing.md#independent-expectations The expected plugin arrays are authored literals derived from the documented option contract (the site's plugins first, then exactly one typia entry when enabled; the site's list untouched when disabled), not read from the service.
 * @evidence contracts/testing.md#distinguishing-cases Typia on with only a site plugin (appended after it), typia on with a duplicate typia entry listed first (one entry, moved after the site plugin), typia off with the same list (untouched) and typia on with none contrast; compile and bundle lanes repeat the first two rows.
 * @evidence contracts/testing.md#execution-ownership This entry owns its makeFakeWorker instances and calls the real service with injected boot, API and host doubles; no WASM runtime runs.
 */
export const test_playground_compile_merges_extra_plugins_with_the_typia_entry =
  async (): Promise<void> => {
    const source = "export const x = 1;";
    const build = () =>
      envelope({ result: compilePayload({ "src/playground.js": "x = 1;" }) });
    const plugins = async (
      options: Record<string, unknown>,
      verb: "compile" | "bundle" = "compile",
    ): Promise<unknown> => {
      const { service, record } = makeFakeWorker(
        { ...BASE_OPTIONS, lintPlugin: false, ...options },
        { build },
      );
      await service[verb]({ source });
      return JSON.parse(record.writes["/work/tsconfig.json"]!).compilerOptions
        .plugins;
    };
    const extra = {
      plugins: [{ transform: "typia/lib/transform" }, { transform: "other" }],
    };

    const typia = { transform: "typia/lib/transform" };
    const site = { transform: "other" };

    for (const verb of ["compile", "bundle"] as const) {
      assert.deepEqual(
        await plugins({ extraCompilerOptions: { plugins: [site] } }, verb),
        [site, typia],
        `${verb}: a site plugin stays and the typia entry is appended after it`,
      );
      assert.deepEqual(
        await plugins({ extraCompilerOptions: extra }, verb),
        [site, typia],
        `${verb}: a site list already holding typia ends with one typia entry, after the site plugin`,
      );
    }
    assert.deepEqual(
      await plugins({ typiaPlugin: false, extraCompilerOptions: extra }),
      extra.plugins,
      "typia off leaves the site's plugins untouched",
    );
    assert.deepEqual(await plugins({}), [{ transform: "typia/lib/transform" }]);
    assert.equal(
      await plugins({ typiaPlugin: false }),
      undefined,
      "no plugins key without typia or extras",
    );
  };
