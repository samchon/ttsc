import { assertTurbopackLoaderForwardsRuleOptions } from "../../internal/adapter-turbopack";

/**
 * Verifies the turbopack loader forwards the rule's `options` object to the
 * ttsc transform.
 *
 * Turbopack rules pass options as `{ loader, options }`; the loader reads them
 * via `this.getOptions()` and they must reach `resolveOptions` like any
 * adapter's constructor options would. Locks the plugin-list override path: if
 * options were dropped, the loader would silently fall back to tsconfig
 * discovery and per-rule configuration would be dead.
 *
 * 1. Create a fixture project with no tsconfig plugins.
 * 2. Invoke the loader with `options.plugins` running the fixture's `go-prefix`
 *    operation.
 * 3. Assert the prefixed output — only reachable through the options object.
 */
export const test_turbopack_loader_forwards_rule_options_to_the_transform =
  async () => {
    await assertTurbopackLoaderForwardsRuleOptions();
  };
