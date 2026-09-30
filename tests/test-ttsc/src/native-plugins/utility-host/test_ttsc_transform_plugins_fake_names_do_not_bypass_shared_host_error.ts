import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { nativePluginSource } from "../../internal/plugin-corpus";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc transform plugins: fake names do not bypass shared-host errors.
 *
 * Locks the generic host-selection rule. Plugin names are labels only; naming
 * an executable plugin after a package that happens to ship in this repo must
 * not grant it linked-host behavior or any other special treatment.
 *
 * 1. Two executable transform descriptors use names that look like package IDs.
 * 2. Run ttsc with both descriptors in one emit pass.
 * 3. Assert the normal multiple-native-backends error is reported.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual CLI must reject two executable sources even when their descriptor names imitate built-in linked packages.
 * @evidence contracts/testing.md#independent-expectations Two distinct Go main packages and literal multiple-backend diagnostic establish incompatible compiler owners independently of plugin labels.
 * @evidence contracts/testing.md#distinguishing-cases Owns false built-in labels on executable sources and public nonzero error transport; does not impersonate actual linked implementations.
 * @evidence contracts/testing.md#execution-ownership The matching named utility-host export executes one real descriptor-admission and compatibility pass in the shared Linux native population.
 * @evidence contracts/e2e.md#necessary-boundary The real loader must classify both Go main sources as executable owners before the shared-host guard; a guard unit with preselected kinds does not establish that earlier classification.
 * @evidence contracts/e2e.md#shared-execution The canonical transformer and driver-emit producers already used by the batch share native binaries and compiler objects; no extra empty Go programs are compiled for labels.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh distinct descriptor/source modules prevent equal-identity reuse from hiding incompatible owners; names are input labels rather than asserted native routing authority.
 * @evidence contracts/e2e.md#preserved-coverage Both original public nonzero exit and exact multiple-native-backend diagnostic remain. Actual source-classifier and host-guard units additionally preserve the original two empty main-package inputs; this shared-producer survivor retains their real loader-to-BuildExecution connection.
 */
export function test_ttsc_transform_plugins_fake_names_do_not_bypass_shared_host_error(): void {
    const root = TestProject.commonJsProject(
      {
        "src/main.ts": `export const value = "x";\n`,
        "plugins/fake-banner.cjs": `
        module.exports = (context) => ({
          name: "@ttsc/banner",
          source: ${JSON.stringify(nativePluginSource("transformer"))},
          stage: "transform",
        });
      `,
        "plugins/fake-strip.cjs": `
        module.exports = (context) => ({
          name: "@ttsc/strip",
          source: ${JSON.stringify(nativePluginSource("driver-emit"))},
          stage: "transform",
        });
      `,
      },
      {
        compilerOptions: {
          plugins: [
            { transform: "./plugins/fake-banner.cjs" },
            { transform: "./plugins/fake-strip.cjs" },
          ],
        },
      },
    );
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /multiple compiler native backends cannot share one emit pass/,
    );
  }
