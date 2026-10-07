package evidence

import (
  "fmt"
  "strings"
  "testing"
)

// TestMarkdownExamplesCannotDischargeGraphObligations verifies example
// citations, exclusions and reviews cannot make the actual graph pass.
//
// Scanner counts alone do not establish coverage behavior. These fixtures run
// the production graph rule over Markdown claims and references, then contrast
// each example with a genuine comment carrying the same annotation.
//
// 1. Put a citation or exclusion in each example region and require missing coverage.
// 2. Add a genuine comment and require the graph to pass.
// 3. Require a review, put it only in an example, then move it to a real comment.
//
// @evidence contracts/testing.md#behavioral-verification runIndexRule invokes graphRule.Check on Markdown populations. Each example citation/exclusion leaves exactly one missing acknowledgement; a real following comment clears it. With requireReview, an example review leaves exactly one missing-review diagnostic and a real review clears it.
// @evidence contracts/testing.md#independent-expectations Only real HTML comment annotations supply coverage or review pairing. The literal missing target and diagnostic counts follow from one authored reference unit and one claim host. A requested fingerprint is used only to prepare a valid review token, not as an oracle for fingerprint bytes.
// @evidence contracts/testing.md#distinguishing-cases Tests backtick/tilde fences, spaces/tabs, inline code, escaped comment openers, raw pre and MDX templates, close-open transitions and quoted attributes, contrasting example-only annotations with a real comment after the region. Citation, exclusion and both review kinds each retain their own failure identity.
// @evidence contracts/testing.md#execution-ownership The Go unit entry owns all table subtests and calls the project rule directly through runIndexRule. Its temporary Markdown files are resolver inputs; it neither installs a consumer nor builds a native artifact or starts a product host.
func TestMarkdownExamplesCannotDischargeGraphObligations(t *testing.T) {
  config := `{"claims":[{"type":"markdown","files":["claim.md"],"symbol":"h1","reference":{"type":"markdown","files":["spec.md"],"symbol":"h1"}}]}`
  reviewed := strings.Replace(config, `"symbol":"h1"}}]}`, `"symbol":"h1","requireReview":true}}]}`, 1)
  fingerprint := everyExpectedFingerprint(t, map[string]string{
    "spec.md": "# Rule\n",
    "claim.md": "# Claim\n<!-- @evidence spec.md#rule Real. -->\n",
  }, reviewed)["spec.md#rule"]
  if fingerprint == "" {
    t.Fatal("the review-required reference supplied no fingerprint for fixture preparation")
  }
  wrappers := map[string]string{
    "fence": "```md\n%s\n```\n",
    "tilde fence": "~~~md\n%s\n~~~\n",
    "indent": "    %s\n",
    "tab": "\t%s\n",
    "inline": "`%s`\n",
    "escape": "\\%s\n",
    "quoted fence": "> ```md\n> %s\n> ```\n",
    "list fence": "1. ```md\n   %s\n   ```\n",
    "quoted list fence": "> - ```md\n>   %s\n>   ```\n",
    "quoted indent": ">     %s\n",
    "list indent": "- item\n\n      %s\n",
    "multiline inline": "``first\nx %s\nlast``\n",
    "mdx interior fence": "<Code code={`\n```md\n%s\n```\n`} />\n",
    "pre": "<pre>\n%s\n</pre>\n",
    "pre one line": "<pre>%s</pre>\n",
    "pre reopening": "<pre></pre><pre>\n%s\n</pre>\n",
    "mdx": "<Code code={`\n%s\n`} />\n",
    "mdx reopening": "<Code code={``} /><Code code={`\n%s\n`} />\n",
    "quoted attribute": "<span title=\"%s\">example</span>\n",
  }
  for name, wrapper := range wrappers {
    for _, tag := range []string{"@evidence", "@evidenceExclude"} {
      t.Run(name+"/"+tag, func(t *testing.T) {
        annotation := "<!-- " + tag + " spec.md#rule Example. -->"
        claim := "# Claim\n" + fmt.Sprintf(wrapper, annotation)
        files := map[string]string{"spec.md": "# Rule\n", "claim.md": claim}
        assertReported(t, runIndexRule(t, files, config), "Missing acknowledgement for 'spec.md#rule'")
        files["claim.md"] = claim + annotation + "\n"
        assertNoProblems(t, runIndexRule(t, files, config))
        reviewTag := "@evidenceReview"
        if tag == "@evidenceExclude" {
          reviewTag = "@evidenceExcludeReview"
        }
        review := "<!-- " + reviewTag + " spec.md#rule #" + fingerprint + " Checked. -->"
        files["claim.md"] = "# Claim\n" + annotation + "\n" + fmt.Sprintf(wrapper, review)
        assertReported(t, runIndexRule(t, files, reviewed), "Unreviewed "+tag+" for 'spec.md#rule'")
        files["claim.md"] += review + "\n"
        assertNoProblems(t, runIndexRule(t, files, reviewed))
      })
    }
  }
}
