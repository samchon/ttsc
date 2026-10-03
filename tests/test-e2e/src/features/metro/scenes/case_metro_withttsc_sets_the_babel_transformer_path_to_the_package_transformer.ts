import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { MetroWorkspace } from "../../../internal/metro/internal/MetroWorkspace";
import { TestMetroRuntime } from "../../../internal/metro/internal/metro-runtime";

/**
 * Verifies withTtsc sets the babel transformer path to the package transformer.
 *
 * Metro discovers a custom transformer through
 * `transformer.babelTransformerPath` and requires it by absolute path. If
 * withTtsc set a relative, missing, or wrong path, Metro would silently keep
 * its default Babel transformer and the ttsc plugin pass would never run.
 *
 * 1. Wrap a minimal Metro config with withTtsc.
 * 2. Read `transformer.babelTransformerPath` from the result.
 * 3. Assert the absolute transformer.js path, require it and call getCacheKey.
 *
 * @evidence contracts/testing.md#behavioral-verification Built withTtsc returns an absolute transformer.js path; requiring that returned artifact and calling getCacheKey produces a 64-character hexadecimal key.
 * @evidence contracts/testing.md#independent-expectations Absolute returned transformer.js, actual require and hex64 key follow the configured loader/return contract. Hex shape is not independent valid-fingerprint proof because fallback nonce can satisfy it; actual source options consumption is not inferred.
 * @evidence contracts/testing.md#distinguishing-cases The returned path is required and getCacheKey runs instead of an existsSync-only check; transform is not invoked. Original source config option/absence matrices are not asserted by this scenario and no generic transferred-owner coverage is claimed.
 * @evidence contracts/testing.md#execution-ownership test_e2e_metro invokes config-to-returned-artifact interoperation through default built index unless TTSC_TEST_LAYER=unit. The returned CJS transformer is required explicitly; this does not start a Metro server/worker or install a packed consumer, and source override does not certify built index assembly.
 * @evidence contracts/e2e.md#necessary-boundary This checks the actual emitted index-to-transformer connection supplied to Metro rather than only computing a source path string.
 * @evidence contracts/e2e.md#shared-execution Shared built artifacts and CJS require cache serve one config/returned-key observation in a separate bare slot; no transform or new installation is requested. Parent calls do not count internal child/Program/cache populations, and retained module options are not proved freshly consumed by key shape.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Exact absent/value options env restores in finally, confineSession restores session/temp env after the awaited callback, and slot reset plus parent aggregate cleanup owns fixture state. Shared CJS module retention remains; no cold options-cache, arbitrary descendant or loaded-image certificate is inferred.
 * @evidence contracts/e2e.md#preserved-coverage The original string, absolute and transformer.js assertions remain; actual require/getCacheKey replaces a file-presence assertion with functioning behavior.
 */
export async function case_metro_withttsc_sets_the_babel_transformer_path_to_the_package_transformer(
  workspace: MetroWorkspace.IWorkspace,
): Promise<void> {
  const { ENV_KEY } = await TestMetroRuntime.loadOptions();
  const previous = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  try {
    await TestMetroRuntime.confineSession(async () => {
    const { withTtsc } = await TestMetroRuntime.loadIndex();
    const config = withTtsc({
      projectRoot: MetroWorkspace.enterBare(workspace, "config"),
      transformer: {},
    });
    const target = config.transformer.babelTransformerPath;
    assert.equal(typeof target, "string");
    assert.equal(path.isAbsolute(target), true);
    assert.match(target, /transformer\.js$/);
    const loaded = createRequire(import.meta.url)(target) as {
      getCacheKey: (...args: unknown[]) => string;
    };
    assert.match(loaded.getCacheKey({ projectRoot: config.projectRoot }), /^[a-f0-9]{64}$/);
    });
  } finally {
    if (previous === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = previous;
  }
}
