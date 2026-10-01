package linthost

import "strings"

// Rule documentation lives in one of two places, and which one is decided by
// the rule's family alone — no per-rule table is maintained here.
//
// Families ported from a plugin that publishes its own rule reference keep
// pointing at that upstream reference, because those pages are the behavioral
// specification `@ttsc/lint` ports against and the one the rule sources already
// cite in their header comments. Every other family is documented only by the
// ttsc website's rule catalog, so its rules link there.
const (
  eslintRuleDocsBaseURL     = "https://eslint.org/docs/latest/rules/"
  unicornRuleDocsBaseURL    = "https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/"
  typescriptRuleDocsBaseURL = "https://typescript-eslint.io/rules/"
  websiteRuleDocsBaseURL    = "https://ttsc.dev/docs/lint/rules/"
)

// websiteDocumentedRuleFamilies lists the families whose whole rule set is
// catalogued on the ttsc website, as one level-3 heading per rule (the rule
// name in a code span) in website/src/content/docs/lint/rules/<family>.mdx.
//
// `format` is deliberately absent. Its 17 rules have no page of their own: the
// `lint/format` guide documents the configuration keys (`semi`, `printWidth`,
// …), which do not correspond one-to-one with the rule names (`format/quotes`,
// `format/clause-join`, `format/whitespace`, …). Emitting an anchor there would
// produce a link to a heading that does not exist, so format findings carry no
// codeDescription at all.
//
// A family missing from this set simply gets no documentation link, which keeps
// a newly added family silent rather than pointing at a page nobody wrote yet.
var websiteDocumentedRuleFamilies = map[string]struct{}{
  "boundaries":      {},
  "cypress":         {},
  "functional":      {},
  "jest":            {},
  "jsdoc":           {},
  "jsx-a11y":        {},
  "nextjs":          {},
  "playwright":      {},
  "promise":         {},
  "react":           {},
  "react-perf":      {},
  "regexp":          {},
  "security":        {},
  "solid":           {},
  "storybook":       {},
  "tanstack-query":  {},
  "testing-library": {},
  "vitest":          {},
}

// ruleDocumentationURL returns the documentation page for a rule name, or an
// empty string when no vetted page exists for it.
//
// Only active built-in rules resolve. The rule-code ledger is append-only, so a
// removed built-in name remains reserved and is not enough to establish runtime
// provenance by itself. The registered rule must also be a native rule rather
// than a public contributor adapter. That keeps a contributor which reuses a
// retired ledger name from inheriting a ttsc or upstream URL.
func ruleDocumentationURL(name string) string {
  candidate := LookupRule(name)
  if candidate == nil {
    return ""
  }
  switch candidate.(type) {
  case contributorAdapter, formatContributorAdapter:
    return ""
  }
  if _, builtIn := builtInRuleCodes[name]; !builtIn {
    return ""
  }
  family, bare, prefixed := strings.Cut(name, "/")
  if !prefixed {
    // An unprefixed built-in name is a core ESLint rule id verbatim.
    return eslintRuleDocsBaseURL + name
  }
  switch family {
  case "unicorn":
    return unicornRuleDocsBaseURL + bare + ".md"
  case "typescript":
    return typescriptRuleDocsBaseURL + bare
  }
  if _, documented := websiteDocumentedRuleFamilies[family]; !documented {
    return ""
  }
  return websiteRuleDocsBaseURL + family + "#" + websiteRuleAnchor(name)
}

// websiteRuleAnchor reproduces the heading id Nextra assigns to the level-3
// heading that documents a rule.
//
// Nextra's remark-headings plugin slugs the heading's flattened text with
// github-slugger, which lowercases and drops characters it does not consider
// word characters — the `/` separator among them. `jsx-a11y/alt-text` therefore
// renders as `#jsx-a11yalt-text`, not `#jsx-a11y-alt-text`, and the one rule
// name carrying an uppercase letter (`security/detect-pseudoRandomBytes`)
// renders fully lowercased. Both fall out of this transform; neither is special
// cased.
func websiteRuleAnchor(name string) string {
  return strings.ToLower(strings.ReplaceAll(name, "/", ""))
}

// lspCodeDescriptionForRule wraps a rule's documentation URL for the wire, or
// returns nil when the rule has none. A nil result keeps `codeDescription`
// absent from the marshalled diagnostic rather than emitting an empty object.
func lspCodeDescriptionForRule(name string) *lspCodeDescription {
  href := ruleDocumentationURL(name)
  if href == "" {
    return nil
  }
  return &lspCodeDescription{Href: href}
}
