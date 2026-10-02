import assert from "node:assert/strict";

import { Scenarios } from "../../../internal/Scenarios";
import { UtilityWorkspace } from "../../../internal/UtilityWorkspace";

/**
 * Verifies the @ttsc/banner plugin: a missing auto-discovered configuration and
 * inline tsconfig options both fail with actionable messages.
 *
 * A package that depends on the plugin but has no `banner.config.*` must fail
 * naming the accepted file names. A tsconfig entry carrying `text` inline must
 * fail naming the unsupported key and pointing to `configFile`.
 *
 * 1. Emit the project with the dependency and no configuration file.
 * 2. Emit the project whose plugin entry carries `text`.
 * 3. Assert both exit nonzero with the expected stderr text.
 *
 * @evidence contracts/testing.md#behavioral-verification The launcher must exit nonzero naming banner.config.{ts,cts,mts,js,cjs,mjs,json} for the missing file and naming the unsupported text key with a configFile hint for the inline entry.
 * @evidence contracts/testing.md#independent-expectations The dedicated-config contract and the documented accepted file names establish both messages independently of the implementation.
 * @evidence contracts/testing.md#distinguishing-cases Missing configuration and inline option are the two negative inputs; the configuration-selection scenario owns valid sources. test_banner_factory_rejects_inline_options directly owns TypeScript descriptor rejection, while the Go config_rejects_unknown_tsconfig_keys unit owns its separate native validator.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_utilities with the shared workspace; both failures cross the built launcher, one from native discovery and one from descriptor validation.
 * @evidence contracts/e2e.md#necessary-boundary Native discovery failure and descriptor validation failure must reach the public launcher status and stderr.
 * @evidence contracts/e2e.md#shared-execution Both failures reuse the shared workspace and package link, with distinct manifest and tsconfig inputs. Missing configuration is reported by the linked native preamble route, whose host may be built or cached; failure recovery can also run the native TypeScript compiler. The inline entry fails in descriptor evaluation. The scenario asserts neither a zero-build count nor equivalent preparation for these routes.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared banner configuration lives in the sibling shared directory, so it is on no ancestor path of either project and cannot satisfy the missing-config discovery; no output is written.
 * @evidence contracts/e2e.md#preserved-coverage Retains the former missing-config and inline-key assertions unchanged; independent collection executes both launcher inputs even when the first one fails its assertions.
 */
export async function case_banner_rejects_missing_config_and_inline_options(
  workspace: UtilityWorkspace.IWorkspace,
): Promise<void> {
  await Scenarios.collect("banner rejected configurations", [
    [
      "missing_configuration",
      () => {
        const missing = UtilityWorkspace.emit(workspace, "auto-missing-config");
        assert.notEqual(missing.status, 0);
        assert.match(
          missing.stderr,
          /banner\.config\.\{ts,cts,mts,js,cjs,mjs,json\}/,
        );
      },
    ],
    [
      "inline_options",
      () => {
        const inline = UtilityWorkspace.emit(workspace, "inline-rejected");
        assert.notEqual(inline.status, 0, 'expected failure for key "text"');
        assert.match(
          inline.stderr,
          /unsupported key.*"text"|"text".*unsupported key/,
          'stderr should name unsupported key "text"',
        );
        assert.match(
          inline.stderr,
          /configFile/,
          'stderr should mention configFile for key "text"',
        );
      },
    ],
  ]);
}
