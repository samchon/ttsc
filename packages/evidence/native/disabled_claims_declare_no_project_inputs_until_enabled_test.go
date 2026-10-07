package evidence

import (
  "github.com/samchon/ttsc/packages/lint/rule"
  "testing"
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
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs calls graphRule.ProjectInputs on a configuration holding a Markdown claim (root `staged-docs`, with a Prisma reference rooted at `staged-schema` and a Swagger reference to `staged/swagger.json`) and an enabled TypeScript claim over docs/live/**\/*.md; with the staged claim disabled the glob inputs must be exactly docs/live/**\/*.md and there must be no file input, and with `disabled` false the globs must be exactly staged-docs/claims/**\/*.md, staged-schema/**\/*.prisma and docs/live/**\/*.md plus the file input staged/swagger.json.
 * @evidence contracts/testing.md#independent-expectations The expected pattern lists are authored from the staging contract: project inputs are declared before a Program exists, so a disabled claim must publish none of its own or its references' topology, and re-enabling the same claim must restore all of it; assertDeclares compares exact sets.
 * @evidence contracts/testing.md#distinguishing-cases The same configuration with only `disabled` flipped isolates the gate: the disabled run must lack three staged inputs that the enabled run has, while the enabled sibling's glob is present in both.
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimsDeclareNoProjectInputsUntilEnabled is a Go unit entry in the native test process; it calls ProjectInputs twice on in-memory project input contexts with no sources, consumer install or product host.
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
