package linthost

import (
  "strings"
  "testing"
)

// TestRuleDocumentationURLsCoverTheBuiltinCorpus verifies every registered
// built-in rule derives a well-formed documentation URL, or none at all.
//
// The derivation is a handful of per-family string rules over ~743 names, so a
// single-rule spot check proves almost nothing: a family whose prefix is not
// handled silently yields no link, and a bad anchor transform yields a link to
// a heading that does not exist. Sweeping the whole registry is what turns
// those into failures. `format` is the one family with no per-rule page, and
// pinning it as the ONLY unmapped family forces a deliberate decision whenever
// a new family is added.
//
//  1. Walk every registered rule that the ledger marks built-in.
//  2. Assert format rules map to nothing and all others map to their family's
//     documentation base.
//  3. Assert website links anchor on the rule name lowercased with `/` removed.
func TestRuleDocumentationURLsCoverTheBuiltinCorpus(t *testing.T) {
  upstreamBases := map[string]string{
    "unicorn":    "https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/",
    "typescript": "https://typescript-eslint.io/rules/",
  }

  mapped, unmapped := 0, 0
  for _, name := range AllRuleNames() {
    if _, builtIn := builtInRuleCodes[name]; !builtIn {
      continue
    }
    got := ruleDocumentationURL(name)
    family, bare, prefixed := strings.Cut(name, "/")

    if family == "format" {
      if got != "" {
        t.Fatalf("format rule %q linked to %q, but no per-rule format page exists", name, got)
      }
      unmapped++
      continue
    }
    if got == "" {
      t.Fatalf("built-in rule %q derived no documentation URL; add its family to "+
        "websiteDocumentedRuleFamilies once website/src/content/docs/lint/rules/%s.mdx "+
        "documents it, or exclude the family deliberately", name, family)
    }
    mapped++

    switch {
    case !prefixed:
      if want := "https://eslint.org/docs/latest/rules/" + name; got != want {
        t.Fatalf("core rule %q = %q, want %q", name, got, want)
      }
    case upstreamBases[family] != "":
      want := upstreamBases[family] + bare
      if family == "unicorn" {
        want += ".md"
      }
      if got != want {
        t.Fatalf("%s rule %q = %q, want %q", family, name, got, want)
      }
    default:
      want := "https://ttsc.dev/docs/lint/rules/" + family + "#" +
        strings.ToLower(strings.ReplaceAll(name, "/", ""))
      if got != want {
        t.Fatalf("website rule %q = %q, want %q", name, got, want)
      }
      // The anchor is a github-slugger id: lowercase, no separator.
      _, anchor, _ := strings.Cut(got, "#")
      if anchor != strings.ToLower(anchor) || strings.Contains(anchor, "/") {
        t.Fatalf("website rule %q produced an unslugged anchor %q", name, anchor)
      }
    }
  }

  if mapped == 0 || unmapped == 0 {
    t.Fatalf("corpus sweep degenerate: mapped=%d unmapped=%d", mapped, unmapped)
  }
}
