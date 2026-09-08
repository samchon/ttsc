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
