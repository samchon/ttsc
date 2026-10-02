// @ttsc-corpus-skip(project): rule requires configured source and target elements; positive project coverage lives at packages/lint/linthost/boundaries_element_types_rejects_disallowed_import_test.go.
// @ttsc-corpus-rule: boundaries/element-types
/**
 * Fixture for `boundaries/element-types`.
 *
 * The rule enforces allowed dependency directions between configured source-
 * path element types. It needs project-level `elements` and `rules` config to
 * fire, so a single virtual fixture cannot produce a diagnostic; the Go test
 * under `packages/lint/linthost/boundaries_*_test.go` pins the actual contract.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to that positive package-level witness.
 */
export {};
