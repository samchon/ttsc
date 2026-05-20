import { assertTransformSkipsProjectPlugins } from "../../internal/transform-disable-plugins";

/**
 * Verifies transformTtsc leaves source unchanged when plugins are disabled.
 *
 * Users can opt out of all ttsc plugin transforms by passing `resolveOptions({
 * plugins: false })`. This is the escape hatch for projects that use the
 * unplugin adapter solely for bundler integration but want no source transforms
 * applied. If this flag were ignored, the transform would run anyway and mutate
 * output the user intended to keep raw. This pins that `plugins: false` causes
 * `transformTtsc` to return `undefined`.
 *
 * 1. Create a fixture project with a source that would trigger a plugin error if
 *    the transform ran.
 * 2. Call `transformTtsc` with `plugins: false`.
 * 3. Assert the return value is `undefined`.
 */
export const test_transformttsc_leaves_source_unchanged_when_plugins_are_disabled =
  async () => {
    await assertTransformSkipsProjectPlugins();
  };
