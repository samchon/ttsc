/**
 * Fixture for `boundaries/dependencies`.
 *
 * The unified upstream rule replaces `element-types` / `entry-point` /
 * `external` / `no-private` / `no-unknown` with one direction-aware
 * policy block. The native port currently ships as a v1 stub: it
 * registers the rule name, accepts the upstream `elements` + `rules`
 * config shape, and emits no diagnostics. The Go test under
 * `packages/lint/test/rules/boundaries/boundaries_dependencies_test.go`
 * pins that contract.
 *
 * This fixture exists to document the rule id in the consumer corpus
 * tree. It declares no `// expect:` annotations, so the corpus runner
 * skips it; once the rule grows real diagnostics, replace this body
 * with annotated positive/negative cases.
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
