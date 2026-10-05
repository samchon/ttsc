package evidence

// hintsMarkdownConfig cites a Markdown population from TypeScript.
const hintsMarkdownConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "reference":{"type":"markdown","files":["docs/**"],"symbol":["file","h2"]}
}]}`

// hintsSatisfiedSource acknowledges the whole document, so the graph passes.
//
// Every fixture here has to pass, because a corpus exists only for a rule that
// passed. Acknowledging the file target is enough: a target covers itself and
// every selected descendant, so the heading beneath it is discharged too.
const hintsSatisfiedSource = `/**
 * @evidence docs/pricing.md Implements the pricing document.
 */
export interface ISale {
  price: number;
}
`

func contains(values []string, expected string) bool {
  return indexOf(values, expected) >= 0
}

func indexOf(values []string, expected string) int {
  for index, value := range values {
    if value == expected {
      return index
    }
  }
  return -1
}
