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
 */
export const test_withttsc_sets_the_babel_transformer_path_to_the_package_transformer =
  async () => {
    await assertWithTtscSetsBabelTransformerPath();
  };
