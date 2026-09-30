package evidence

import (
  "testing"
)

/**
 * Verifies the root grammar: one directory, ascending or absolute, never a glob
 * and never drive-relative.
 *
 * `..` is admitted here precisely because it is refused inside `files`. The
 * escape belongs in one declared place rather than inside every pattern, which
 * is what keeps it auditable — and it is unambiguous once resolved against a
 * known base. A drive-relative path is not: `C:docs` resolves against whatever
 * directory that drive currently sits on, which is the same rejection
 * `TestGlobRejectsWindowsDrivePaths` records for `files`.
 *
 *  1. Normalize the accepted spellings.
 *  2. Normalize each refused spelling.
 *  3. Assert acceptance, canonical form, and refusal.
 *
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification normalizeRootPath preserves the accepted table, maps dot to default and rejects the malformed table.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Explicit value-to-output map and invalid strings define grammar independently.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Default, ascent, absolute and ambiguous spellings execute under this entry.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestRootGrammarAcceptsAscentAndRefusesAmbiguity is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestRootGrammarAcceptsAscentAndRefusesAmbiguity(t *testing.T) {
  accepted := map[string]string{
    "docs":              "docs",
    "./docs":            "docs",
    `..\..\docs`:        "../../docs",
    "../docs/":          "../docs",
    "/srv/contracts":    "/srv/contracts",
    "C:/shared/schema":  "C:/shared/schema",
    "docs/../packaging": "packaging",
    // A drive root keeps its separator. `path.Clean` reads `C:` as an
    // ordinary segment and strips the slash behind it, after which the
    // Windows path API calls the result relative and resolves it against the
    // project — a silently different directory.
    "C:/": "C:/",
  }
  for value, want := range accepted {
    got, problem := normalizeRootPath(value)
    if problem != "" {
      t.Fatalf("root %q was refused: %s", value, problem)
    }
    if got != want {
      t.Fatalf("root %q normalized to %q, want %q", value, got, want)
    }
  }
  // `.` is the project root spelled out, so it is the default base rather than
  // a second base that addresses the same files identically.
  if got, problem := normalizeRootPath("."); got != "" || problem != "" {
    t.Fatalf("root '.' normalized to %q with %q, want the default base", got, problem)
  }
  for _, value := range []string{"", " docs", "docs ", "docs/**", "spec?", "C:docs", "C:"} {
    if _, problem := normalizeRootPath(value); problem == "" {
      t.Fatalf("root %q was accepted", value)
    }
  }
}
