// @ttsc-corpus-skip(project): rule requires configured cross-element private paths; positive project coverage lives at packages/lint/test/rules/boundaries/boundaries_no_private_rejects_cross_element_private_import_test.go.
// @ttsc-corpus-rule: boundaries/no-private
/**
 * Fixture for `boundaries/no-private`.
 *
 * The rule rejects imports of configured private files from outside their
 * element. It needs project-level configuration to fire; the Go test under
 * `packages/lint/test/rules/boundaries/` pins the actual contract.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to that positive package-level witness.
 */
export {};
