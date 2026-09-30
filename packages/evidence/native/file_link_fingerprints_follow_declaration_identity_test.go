package evidence

import (
  "regexp"
  "testing"
)

/**
 * Verifies code fingerprints survive export projections and expire on rebinding.
 *
 * A type-only edge withholds members from coverage but cannot change a cited
 * class's content. Identical text in another file remains another declaration.
 *
 * 1. Cite one class through type-only and value export populations.
 * 2. Assert both references demand the same fingerprint.
 * 3. Rebind the barrel to identical text in another file and assert expiry.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule compares review fingerprints for Target reached directly and through Public; one accepted review must become stale after the barrel rebinds to an identical-text Other declaration.
 * @evidence contracts/testing.md#independent-expectations Projection aliases must share a declaration identity while a different declaration changes the scope fingerprint. The diagnostic-derived seed is protocol setup, not an independent exact hash oracle.
 * @evidence contracts/testing.md#distinguishing-cases Both references and direct/barrel spellings challenge projection dependence; rebind with unchanged text distinguishes identity from content alone.
 * @evidence contracts/testing.md#execution-ownership TestFileLinkFingerprintsFollowDeclarationIdentity is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
 */
func TestFileLinkFingerprintsFollowDeclarationIdentity(t *testing.T) {
  config := `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":[{"type":"typescript","files":["src/b.ts"],"symbol":"type","requireReview":true},{"type":"typescript","files":["src/a.ts","src/b.ts"],"symbol":"type","requireReview":true}]}]}`
  files := map[string]string{"src/a.ts": "export class Target { value = 1; }", "src/other.ts": "export class Target { value = 1; }", "src/b.ts": "export type { Target as Public } from './a';", "review.md": "## Review\n<!-- @link src/b.ts#Public Reviews the class. -->\n"}
  pattern := regexp.MustCompile(` #([0-9a-f]{7}) `)
  messages := runIndexRule(t, files, config)
  fingerprint := ""
  for _, message := range messages {
    match := pattern.FindStringSubmatch(message)
    if len(match) != 2 {
      t.Fatalf("expected review fingerprint: %v", messages)
    }
    if fingerprint != "" && fingerprint != match[1] {
      t.Fatalf("type-only projection changed the fingerprint: %v", messages)
    }
    fingerprint = match[1]
  }
  files["review.md"] += "<!-- @evidenceReview src/b.ts#Public #" + fingerprint + " Checked this declaration. -->\n"
  assertNoProblems(t, runIndexRule(t, files, config))
  files["src/b.ts"] = "export type { Target as Public } from './other';"
  assertProblemContains(t, runIndexRule(t, files, config), "Stale @evidenceReview")
}
