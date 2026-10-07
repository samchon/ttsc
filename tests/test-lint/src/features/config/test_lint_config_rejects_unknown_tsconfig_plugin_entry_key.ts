import assert from "node:assert/strict";

import { TestLintPlugin } from "../internal/TestLintPlugin";

/**
 * Verifies stale inline lint options on the tsconfig plugin entry are rejected.
 *
 * The descriptor factory rejects any plugin-entry key other than the framework
 * keys and configFile, so a legacy rules, format, extends, config or plugins
 * key cannot be silently ignored. This case does not observe whether the
 * rejection precedes configuration-file discovery.
 *
 * 1. Call the factory with each stale key in a plugin entry and require an
 *    unsupported-key error naming that key.
 * 2. Call it with a host switch and an explicit configFile that does not exist and
 *    require that it does not throw.
 *
 * @evidence contracts/testing.md#behavioral-verification The authored factory is called with the original inline rules value and must throw an unsupported-key error naming rules; format, extends, config and plugins keys are each rejected the same way, while an entry with only transform, enabled and configFile is accepted.
 * @evidence contracts/testing.md#independent-expectations The lint plugin-entry contract permits host transform/enabled and configFile only; literal obsolete option names and the migration diagnostic come from that contract.
 * @evidence contracts/testing.md#distinguishing-cases The original rules object remains the negative case, supplemented by format, extends, config, plugins and an arbitrary futureOption key. That arbitrary key distinguishes an allowlist from a legacy-key denylist. A supported disabled entry with explicit missing configFile is the adjacent accepted control.
 * @evidence contracts/testing.md#execution-ownership This named source unit reaches rejectUnsupportedEntryKeys through the authored factory without starting the launcher or building Go. Real descriptor-load failures in the existing evaluator E2E population retain host error propagation.
 */
export function test_lint_config_rejects_unknown_tsconfig_plugin_entry_key(): void {
  const factory = TestLintPlugin.loadFactory();
  for (const [key, value] of [
    ["rules", { "no-console": "error" }],
    ["format", {}],
    ["extends", "./legacy.json"],
    ["config", {}],
    ["plugins", {}],
    ["futureOption", true],
  ] as const) {
    assert.throws(
      () =>
        factory(
          TestLintPlugin.factoryContext({
            transform: "@ttsc/lint",
            [key]: value,
          }),
        ),
      new RegExp('unsupported key "' + key + '"'),
    );
  }
  assert.doesNotThrow(() =>
    factory(
      TestLintPlugin.factoryContext({
        transform: "@ttsc/lint",
        enabled: false,
        configFile: "./missing.config.json",
      }),
    ),
  );
}
