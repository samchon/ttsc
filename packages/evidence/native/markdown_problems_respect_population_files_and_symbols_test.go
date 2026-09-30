package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies Markdown scan diagnostics stay inside each configured population's
 * files and symbol selection.
 *
 * The project walk sees claim documents and unrelated repository Markdown,
 * and a malformed heading is reported only where some configured population
 * reads it. Materializing no unit for it is unconditional; the diagnostic is
 * what the population gates. Both sides ask that question now, so the boundary
 * is each population's own `files` globs and its own symbol set rather than the
 * distinction between a claim and a reference. Reporting every malformed
 * heading would make the globs stop being a real boundary.
 *
 *  1. Put an empty H2 in the reference file, the claim file, and an unrelated file.
 *  2. Have the reference select H1 and assert no empty H2 is reported, since neither population reads that kind.
 *  3. Have the reference select H2 and assert only its own file is reported, since the claim still reads only `file`.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification graphRule.Check through the authored project-rule fixture exercises this case. Verifies Markdown scan diagnostics stay inside each configured population's files and symbol selection.
 *
 * @evidence .agents/skills/contracts/testing.md#independent-expectations An H1-only reference has no empty-H2 report; changing only its selector to H2 requires exactly one report at docs/source.md:2, excluding claim and unrelated files.
 *
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Put an empty H2 in the reference file, the claim file, and an unrelated file. Have the reference select H1 and assert no empty H2 is reported, since neither population reads that kind. Have the reference select H2 and assert only its own file is reported, since the claim still reads only `file`.
 *
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestMarkdownProblemsRespectPopulationFilesAndSymbols is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the authored project-rule fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestMarkdownProblemsRespectPopulationFilesAndSymbols(t *testing.T) {
  files := map[string]string{
    "docs/source.md": "# Selected\n##\n",
    "docs/ref.md":    "<!-- @evidence docs/source.md#selected The claim adopts the H1. -->\n##\n",
    "notes/other.md": "##\n",
  }
  h1Messages := runIndexRule(t, files, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h1"}
  }]}`)
  assertNoProblems(t, h1Messages)

  h2Messages := runIndexRule(t, files, `{"claims":[{
    "type":"markdown",
    "files":["docs/ref.md"],
    "symbol":"file",
    "reference":{"type":"markdown","files":["docs/source.md"],"symbol":"h2"}
  }]}`)
  if got := countProblemsContaining(h2Messages, "has no resolvable anchor"); got != 1 {
    t.Fatalf("source-scoped Markdown problems = %d: %s", got, strings.Join(h2Messages, "\n"))
  }
  assertProblemContains(t, h2Messages, "docs/source.md:2")
}
