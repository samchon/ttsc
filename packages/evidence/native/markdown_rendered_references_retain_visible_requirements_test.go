package evidence

import "testing"

// TestMarkdownRenderedReferencesRetainVisibleRequirements verifies literal
// rendered delimiters cannot silently remove later reference obligations, and
// genuine block examples cannot invent extra reference units.
//
// The graph must keep the same two real requirements in both forms. A claim
// citing only the first stays incomplete instead of passing through inventory
// loss, or failing on an invented heading inside a genuine example.
//
// 1. Select two visible H1 requirements around each literal or block example.
// 2. Cite only the first and require exactly the second missing acknowledgement.
// 3. Cite the second too and require a clean graph.
//
// @evidence contracts/testing.md#behavioral-verification Calls graphRule.Check through runIndexRule over real Markdown reference and claim files. Inline literal delimiters, genuine pre/MDX blocks, comments and reopened regions retain exactly the missing second requirement, then both genuine citations make the graph pass.
// @evidence contracts/testing.md#independent-expectations The authored document contains exactly two visible H1 requirements; a hidden example heading supplies no obligation. One or two real citations independently determine the one missing target or clean result without computing the inventory in the test.
// @evidence contracts/testing.md#distinguishing-cases Contrasts literal pre/MDX text and comment-contained openers with real rendered regions containing a fake H1, including same-line close/open transitions. A citation added for the visible second requirement is the positive completeness boundary.
// @evidence contracts/testing.md#execution-ownership This Go unit entry owns every table row and invokes the graph rule in the native test process. Its temporary Markdown files are actual scanner inputs without consumer installation, native production build or subprocess host.
func TestMarkdownRenderedReferencesRetainVisibleRequirements(t *testing.T) {
  config := `{"claims":[{"type":"markdown","files":["claim.md"],"symbol":"h1","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`
  for name, example := range map[string]string{
    "inline pre": "Discuss `<pre>` and `</pre>` here.\n",
    "inline mdx": "Discuss ``<Code code={` `` here.\n",
    "comment": "<!-- <pre>\n# Hidden\n-->\n",
    "pre": "<pre>\n# Hidden\n</pre>\n",
    "pre reopen": "<pre></pre><pre>\n# Hidden\n</pre>\n",
    "mdx": "<Code code={`\n# Hidden\n`} />\n",
    "mdx reopen": "<Code code={``} /><Code code={`\n# Hidden\n`} />\n",
  } {
    t.Run(name, func(t *testing.T) {
      files := map[string]string{
        "spec.md": "# First\n\n" + example + "\n# Second\n",
        "claim.md": "# Claim\n<!-- @evidence spec.md#first Implements the first rule. -->\n",
      }
      assertReported(t, runIndexRule(t, files, config), "Missing acknowledgement for 'spec.md#second'")
      files["claim.md"] += "<!-- @evidence spec.md#second Implements the second rule. -->\n"
      assertNoProblems(t, runIndexRule(t, files, config))
    })
  }
}
