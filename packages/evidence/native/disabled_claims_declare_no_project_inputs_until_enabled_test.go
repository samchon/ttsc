package evidence

import (
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies disabled claims publish none of their own or referenced external
 * topology while enabled siblings remain watched.
 *
 * Project inputs run before a Program exists, so filtering only inside
 * `Check` would leave staged Markdown, Prisma, and Swagger populations live in
 * watch mode. Re-enabling the same claim must restore every dependency.
 *
 *  1. Disable a Markdown claim with Prisma and Swagger references beside one
 *     enabled Markdown reference.
 *  2. Assert only the enabled dependency is declared.
 *  3. Flip `disabled` to false and assert every staged dependency returns.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.ProjectInputs returns only docs/live/**/*.md while the staged claim is disabled. Enabling that same claim restores staged-docs/claims/**/*.md, staged-schema/**/*.prisma and the exact staged/swagger.json file input while preserving the live glob.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Project inputs run before a Program exists, so filtering only inside `Check` would leave staged Markdown, Prisma, and Swagger populations live in watch mode. Re-enabling the same claim must restore every dependency.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Disable a Markdown claim with Prisma and Swagger references beside one enabled Markdown reference. Assert only the enabled dependency is declared. Flip `disabled` to false and assert every staged dependency returns.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestDisabledClaimsDeclareNoProjectInputsUntilEnabled is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestDisabledClaimsDeclareNoProjectInputsUntilEnabled(t *testing.T) {
  configuration := func(disabled string) string {
    return `{"claims":[
      {
        "type":"markdown",
        "disabled":` + disabled + `,
        "root":"staged-docs",
        "files":["claims/**/*.md"],
        "reference":[
          {"type":"prisma","root":"staged-schema","files":["**/*.prisma"]},
          {"type":"swagger","file":"staged/swagger.json"}
        ]
      },
      {
        "type":"typescript",
        "files":["src/**"],
        "reference":{"type":"markdown","files":["docs/live/**/*.md"]}
      }
    ]}`
  }

  disabled := declaredInputs(t, configuration("true"))
  assertDeclares(t, disabled, rule.ProjectInputGlob, []string{"docs/live/**/*.md"})
  assertDeclares(t, disabled, rule.ProjectInputFile, nil)

  enabled := declaredInputs(t, configuration("false"))
  assertDeclares(t, enabled, rule.ProjectInputGlob, []string{
    "staged-docs/claims/**/*.md",
    "staged-schema/**/*.prisma",
    "docs/live/**/*.md",
  })
  assertDeclares(t, enabled, rule.ProjectInputFile, []string{"staged/swagger.json"})
}
