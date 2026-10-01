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
 * 3. Assert it is an absolute path ending in `transformer.js` that exists on disk.
 *
 * @evidence contracts/testing.md#behavioral-verification Built withTtsc returns an absolute transformer.js path; requiring that returned artifact and calling getCacheKey produces a 64-character hexadecimal key.
 * @evidence contracts/testing.md#independent-expectations Metro requires the configured path and consumes its key; absolute path shape plus actual loader/key execution independently detect unusable assembly.
 * @evidence contracts/testing.md#distinguishing-cases The config-returned path is executed, strengthening the former existsSync check; source config units separately preserve unrelated fields and absent blocks.
 * @evidence contracts/testing.md#execution-ownership Called by test_e2e_metro, which is discovered under src/features and selected by the E2E Evidence claim; this exported scenario executes the compiled Metro package, while source units own its portable decisions.
 * @evidence contracts/e2e.md#necessary-boundary This checks the actual emitted index-to-transformer connection supplied to Metro rather than only computing a source path string.
 * @evidence contracts/e2e.md#shared-execution This returned-path check borrows the same built CJS transformer and require cache as the CJS loader entry; its separate project directory prevents snapshot pollution, without another build or host. Its project root is a bare slot of the experiment's single workspace.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity No caller config or emitted module is rewritten. Entering the slot replaces it, which removes any earlier snapshot, epoch and recorded input, and the experiment removes the whole workspace and verifies its absence once, after the last scenario.
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
