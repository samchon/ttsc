/**
 * Fixture for `boundaries/dependencies`.
 *
 * The unified upstream rule replaces `element-types` / `entry-point` /
 * `external` / `no-private` / `no-unknown` with one direction-aware
 * policy block. The native port resolves local targets through TypeScript,
 * classifies aliases and relative imports against `elements`, and evaluates
 * ordered allow/disallow effects across entity and dependency metadata.
 *
 * This fixture exists to document the rule id in the consumer corpus
 * tree. It declares no `// expect:` annotations, so the corpus runner
 * skips it; package-level tests materialize the multi-file layouts and real
 * command runs needed to exercise the rule.
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
