// @ttsc-corpus-skip(project): rule requires a configured multi-file element graph; positive project coverage lives at packages/lint/test/rules/boundaries/boundaries_no_unknown_rejects_unknown_import_target_test.go.
// @ttsc-corpus-rule: boundaries/no-unknown
/**
 * Fixture for `boundaries/no-unknown`.
 *
 * The rule rejects relative imports whose resolved source file matches no
 * configured element. It needs project-level configuration to fire; the Go
 * test under `packages/lint/test/rules/boundaries/` pins the actual contract.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to that positive package-level witness.
 */
export {};
