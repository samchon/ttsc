package linthost

import "testing"

// TestUnicornTextEncodingIdentifierCaseEnforcesDashInJsxCharsetAttributes
// verifies the JSX `<meta charset>` and `<form accept-charset>` attribute values
// demand the dashed `utf-8`, while any other element or attribute falls back to
// the dash-less default.
//
// The browser reads these attributes as WHATWG labels, so only they flip the
// canonical form. The gate is element-and-attribute specific: a `charset` on a
// non-`meta` tag, or a non-charset attribute on `<meta>`, must NOT force the
// dash — otherwise the rule would push `utf8` toward `utf-8` everywhere JSX
// appears.
//
//  1. Parse each fixture as TSX so the attribute becomes a JSX node.
//  2. For charset/accept-charset attributes, assert the suggestion is `utf-8`.
//  3. For off-target elements/attributes, assert the default `utf8` (or silence).
func TestUnicornTextEncodingIdentifierCaseEnforcesDashInJsxCharsetAttributes(t *testing.T) {
  findingsFor := func(source string) []*Finding {
    _, _, findings := runRuleFindingsSnapshotFile(
      t,
      unicornTextEncodingIdentifierCaseRuleName,
      "main.tsx",
      source,
      nil,
    )
    return findings
  }
  assertSuggests := func(source, want string) {
    findings := findingsFor(source)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", source, len(findings), findings)
    }
    if len(findings[0].Fix) != 0 {
      t.Fatalf("%q: JSX attributes are suggestions, not autofixes, got %+v", source, findings[0].Fix)
    }
    if len(findings[0].Suggestions) != 1 || len(findings[0].Suggestions[0].Edits) != 1 ||
      findings[0].Suggestions[0].Edits[0].Text != want {
      t.Fatalf("%q: want suggestion rewriting to %q, got %+v", source, want, findings[0].Suggestions)
    }
  }
  assertSilent := func(source string) {
    if findings := findingsFor(source); len(findings) != 0 {
      t.Fatalf("%q: want 0 findings, got %d (%+v)", source, len(findings), findings)
    }
  }

  // Charset attributes force the dashed WHATWG spelling. The self-closing and
  // paired-tag forms exercise the JsxSelfClosingElement and JsxOpeningElement
  // parent paths respectively.
  assertSuggests("const el = <meta charset=\"utf8\" />;\nvoid el;\n", "utf-8")
  assertSuggests("const el = <meta charset=\"utf8\"></meta>;\nvoid el;\n", "utf-8")
  assertSuggests("const el = <form acceptCharset=\"utf8\" />;\nvoid el;\n", "utf-8")
  assertSuggests("const el = <form accept-charset=\"utf8\" />;\nvoid el;\n", "utf-8")

  // A non-charset attribute on <meta> stays on the dash-less default.
  assertSuggests("const el = <meta name=\"utf-8\" />;\nvoid el;\n", "utf8")

  // Already-dashed charset, and a charset-shaped attribute on the wrong
  // element, report nothing.
  assertSilent("const el = <meta charset=\"utf-8\" />;\nvoid el;\n")
  assertSilent("const el = <div charset=\"utf8\" />;\nvoid el;\n")
}
