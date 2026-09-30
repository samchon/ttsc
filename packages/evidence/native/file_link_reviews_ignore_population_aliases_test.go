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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule gathers review findings for Public.property reached through a barrel and a source glob, with Markdown and TypeScript claim carriers; exactly one unique fingerprint is required.
 * @evidence contracts/testing.md#independent-expectations One resolved declaration scope has one fingerprint regardless of population alias. This is an equality relation over implementation-produced values, not a known hash oracle.
 * @evidence contracts/testing.md#distinguishing-cases The two carrier subtests vary syntax while comparing repeated projections; the nonempty fingerprint set detects absence, but does not assert each finding's count or content.
 * @evidence contracts/testing.md#execution-ownership TestFileLinkReviewsIgnorePopulationAliases is a selectable native Go unit entry. Its graph helper parses fixture TypeScript and calls graphRule.Check in the same Go process; temporary Markdown/TypeScript files are resolver inputs, without an installed consumer or product host.
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
