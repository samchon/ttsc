import { assertWithTtscSetsBabelTransformerPath } from "../../internal/metro-config";

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
 * @evidence contracts/testing.md#execution-ownership This named features export test_withttsc_sets_the_babel_transformer_path_to_the_package_transformer executes the compiled Metro package in the E2E runner; source units own its portable decisions and the leaf helper retains this case assertions.
 * @evidence contracts/e2e.md#necessary-boundary This checks the actual emitted index-to-transformer connection supplied to Metro rather than only computing a source path string.
 * @evidence contracts/e2e.md#shared-execution This returned-path check borrows the same built CJS transformer and require cache as the CJS loader entry; its separate project directory prevents snapshot pollution, without another build or host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Worker environment is saved/restored and the session is confined to a tracked temporary project. No caller config or emitted module is rewritten.
 * @evidence contracts/e2e.md#preserved-coverage The original string, absolute and transformer.js assertions remain; actual require/getCacheKey replaces a file-presence assertion with functioning behavior.
 */
export const test_withttsc_sets_the_babel_transformer_path_to_the_package_transformer =
  async () => {
    await assertWithTtscSetsBabelTransformerPath();
  };
