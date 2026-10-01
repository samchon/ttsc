// @ttsc-corpus-skip(project): rule requires a configured multi-file element graph; positive project coverage lives at packages/lint/test/rules/boundaries/boundaries_dependencies_test.go.
// @ttsc-corpus-rule: boundaries/dependencies
/**
 * Fixture for `boundaries/dependencies`.
 *
 * The unified upstream rule replaces `element-types` / `entry-point` /
 * `external` / `no-private` / `no-unknown` with one direction-aware
 * policy block. The native port resolves local targets through TypeScript,
 * classifies aliases and relative imports against `elements`, and evaluates
 * ordered allow/disallow effects across entity and dependency metadata.
 *
 * This fixture documents the rule id in the consumer corpus tree. Its audited
 * project skip points to the package-level test that materializes the
 * multi-file layout needed to exercise the rule.
 *
 * Example config:
 *
 *     {
 *       "boundaries/dependencies": ["error", {
 *         "elements": [
 *           { "type": "app", "pattern": "src/app/**" },
 *           { "type": "domain", "pattern": "src/domain/**" }
 *         ],
 *         "rules": [
 *           { "from": "app", "disallow": "domain" }
 *         ]
 *       }]
 *     }
 */

export {};
