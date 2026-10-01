// @ttsc-corpus-skip(project): rule requires a configured multi-file public entry; positive project coverage lives at packages/lint/test/rules/boundaries/boundaries_entry_point_rejects_non_entry_import_test.go.
// @ttsc-corpus-rule: boundaries/entry-point
/**
 * Fixture for `boundaries/entry-point`.
 *
 * The rule requires imports into an element to target its configured public
 * entry files. It needs project-level configuration to fire; the Go test under
 * `packages/lint/test/rules/boundaries/` pins the actual contract.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to that positive package-level witness.
 */
export {};
