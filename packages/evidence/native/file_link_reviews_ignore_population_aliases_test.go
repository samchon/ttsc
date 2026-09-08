package evidence

import (
  "regexp"
  "testing"
)

/**
 * Verifies one code citation requires one fingerprint across overlapping aliases.
 *
 * A reference chooses a population, not the content identity of a review.
 * Adding the declaring module beside a barrel must not change the required hash.
 *
 * 1. Select one declaration through a barrel and through barrel plus source.
 * 2. Cite its barrel address with both references requiring review.
 * 3. Assert both diagnostics demand the same content fingerprint.
 */
func TestFileLinkReviewsIgnorePopulationAliases(t *testing.T) {
  for _, host := range []string{"markdown", "typescript"} {
    t.Run(host, func(t *testing.T) {
      content := "## Review\n<!-- @link ../src/b.ts#Public.property Reviews the public field. -->\n"
      source, symbol := "docs/review.md", "h2"
      if host == "typescript" {
        source, symbol, content = "docs/review.ts", "type", "import type { Public } from '../src/b';\n/** @evidence {@link Public.property} Reviews the public field. */\nexport interface Review {}\n"
      }
      messages := runIndexRule(t, map[string]string{
        "src/a.ts": "export class Target { static property = 1; }",
        "src/b.ts": "export { Target as Public } from './a';",
        source:     content,
      }, `{"claims":[{"type":"`+host+`","files":["`+source+`"],"symbol":"`+symbol+`","reference":[
{"type":"typescript","files":["src/b.ts"],"symbol":"property","requireReview":true},
{"type":"typescript","files":["src/*.ts"],"symbol":"property","requireReview":true}
]}]}`)
      fingerprints := map[string]bool{}
      pattern := regexp.MustCompile(` #([0-9a-f]{7}) `)
      for _, message := range messages {
        if match := pattern.FindStringSubmatch(message); len(match) == 2 {
          fingerprints[match[1]] = true
        }
      }
      if len(fingerprints) != 1 {
        t.Fatalf("one citation must require one fingerprint, got %v: %v", fingerprints, messages)
      }
    })
  }
}
