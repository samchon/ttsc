// @ttsc-corpus-skip(project): rule requires a configured external package policy; positive project coverage lives at packages/lint/test/rules/boundaries/boundaries_external_rejects_disallowed_package_test.go.
// @ttsc-corpus-rule: boundaries/external
/**
 * Fixture for `boundaries/external`.
 *
 * The rule restricts external package imports by package/specifier pattern.
 * It needs project-level `disallow` config to fire; the Go test under
 * `packages/lint/test/rules/boundaries/` pins the actual contract.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to that positive package-level witness.
 */
export {};
