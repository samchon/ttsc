import assert from "node:assert/strict";

import {
  BASE_OPTIONS,
  compilePayload,
  envelope,
  makeFakeWorker,
} from "../internal/fakeWorker";

/**
 * Verifies `extraCompilerOptions.plugins` interacts with the typia entry the
 * way the option documents: the service owns the typia entry, so it appears
 * once and never twice, and a site's own plugins survive when typia is off.
 *
 * The option says the typia plugin entry is added automatically when typia is
 * enabled and sites should not include it. A site that includes it anyway must
 * not produce a duplicated transform, and a disabled typia must not erase the
 * site's own plugin list.
 *
 * 1. Enable typia with extra plugins that already contain the typia transform and
 *    an unrelated plugin, then read the tsconfig written for compile and bundle.
 * 2. Disable typia with the same extra plugins and read the tsconfig again.
 * 3. Enable typia with no extra plugins as the baseline.
 *
 * @evidence contracts/testing.md#behavioral-verification Compiles through createWorkerCompilerService and parses the tsconfig text it writes, comparing the complete compilerOptions.plugins value for each typia and extra-plugin combination.
 * @evidence contracts/testing.md#independent-expectations The expected plugin arrays are authored literals derived from the documented option contract (one typia entry when enabled, the site's list untouched when disabled), not read from the service.
 * @evidence contracts/testing.md#distinguishing-cases Typia on with a duplicate and an unrelated plugin, typia off with the same list, and typia on with none contrast; compile and bundle lanes repeat the first row.
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

    for (const verb of ["compile", "bundle"] as const) {
      const actual = (await plugins({ extraCompilerOptions: extra }, verb)) as {
        transform: string;
      }[];
      assert.equal(
        actual.filter((p) => p.transform === "typia/lib/transform").length,
        1,
        `${verb}: the typia transform appears exactly once`,
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
