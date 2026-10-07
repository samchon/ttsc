package evidence

import (
  "strings"
  "testing"
)

/**
 * TestDocumentationFencesCannotSupplyAnnotationProse verifies examples cannot
 * satisfy required reasons or review descriptions.
 *
 * A real fence ends the pending annotation, even if it contains no tag. Prose
 * after its close belongs to no annotation until another real tag starts.
 *
 * 1. Parse each citation/exclusion/review kind with empty and complete prose.
 * 2. Vary marker, opener length, shorter/invalid closer and termination.
 * 3. Require the next real tag to recover without inheriting example prose.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the shared declaration and review parsers and compares exact reasons/descriptions before fences plus the following real annotation's retained source line.
 * @evidence contracts/testing.md#independent-expectations An example is not an acknowledgement explanation; exact literal empty and complete prose expectations follow the required-reason contract rather than current output.
 * @evidence contracts/testing.md#distinguishing-cases Both acknowledgement kinds and both review kinds, empty versus complete prose, long and short markers, invalid closing suffixes and unterminated examples expose continuation and recovery mistakes.
 * @evidence contracts/testing.md#execution-ownership This native Go parser unit operates in-process on string inputs and does not build or launch a product host.
 */
func TestDocumentationFencesCannotSupplyAnnotationProse(t *testing.T) {
  for _, tag := range []string{"@evidence", "@evidenceExclude", "@evidenceReview", "@evidenceExcludeReview"} {
    for _, reason := range []string{"", "Actual prose."} {
      for _, marker := range []string{"~~~", "````"} {
        t.Run(tag+"/"+reason+"/"+marker, func(t *testing.T) {
          t.Run("closed", func(t *testing.T) {
            body := tag + " spec.md " + reason + "\n" + marker + "text\nexample only\n" + marker[:len(marker)-1] + "\n" + marker + " trailing\n@evidence hidden.md Hidden.\n" + marker + "\nprose after close\n@evidence next.md Next reason."
            declarations, reviews := parseDeclarations(body), parseReviews(body)
            if strings.Contains(tag, "Review") {
              if len(reviews) != 1 || reviews[0].Description != reason {
                t.Fatalf("example supplied review prose: %#v", reviews)
              }
              if len(declarations) != 1 || declarations[0].Target != "next.md" {
                t.Fatalf("review example leaked declarations: %#v", declarations)
              }
            } else if len(declarations) != 2 || declarations[0].Reason != reason || declarations[1].Target != "next.md" {
              t.Fatalf("example supplied citation prose: %#v", declarations)
            }
            next := declarations[len(declarations)-1]
            if next.Reason != "Next reason." || next.LineOffset != 8 {
              t.Fatalf("post-fence tag lost location/prose: %#v", next)
            }
          })
          t.Run("unclosed", func(t *testing.T) {
            unclosed := tag + " spec.md " + reason + "\n" + marker + "text\nexample only"
            if strings.Contains(tag, "Review") {
              if got := parseReviews(unclosed); len(got) != 1 || got[0].Description != reason {
                t.Fatalf("unclosed example supplied description: %#v", got)
              }
            } else if got := parseDeclarations(unclosed); len(got) != 1 || got[0].Reason != reason {
              t.Fatalf("unclosed example supplied reason: %#v", got)
            }
          })
        })
      }
    }
  }
}
