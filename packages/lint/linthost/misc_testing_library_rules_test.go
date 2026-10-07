package linthost

import (
  "encoding/json"
  "testing"
)

// TestMiscTestingLibraryRules verifies seven single-pattern Testing Library
// rules (DOM import, cleanup, test ids, regex flags, user-event setup and
// render-result naming) each report once at the marked source line.
//
// These are the lower-level one-pass checks that need no separate behavioral
// fixture. The configured testIdPattern option proves tuple options reach the
// SourceFile-level rule through `Context.DecodeOptions`.
//
//  1. Mix DOM imports, cleanup, test-id queries and attributes, a direct
//     userEvent call and a render result named `wrapper` in one TSX source.
//  2. Enable the seven rules, with testIdPattern `^[a-z-]+$` for the test-id rule.
//  3. Assert the seven exact rule, severity and line triples.
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify seven exact findings cover DOM import, configured test-id pattern, render-result name, cleanup, test-id query, global-regexp query and direct userEvent; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations The explicit ^[a-z-]+$ option rejects Bad Value, while the named import/query/cleanup policies independently determine the other marked lines.
// @evidence contracts/testing.md#distinguishing-cases This shared source exercises distinct rules including one option-dependent rule; prefer-user-event-setup and no-container tests own their accepted origin distinctions.
// @evidence contracts/testing.md#execution-ownership TestMiscTestingLibraryRules assertTestingLibraryFindingsWithResolver runs NewEngineWithResolver with an InlineRuleResolver holding the seven single-pattern rules and the consistent-data-testid testIdPattern option payload over one TSX source and compares seven exact rule/severity/line triples. No DOM runtime, installed consumer, native build or product child host runs.
func TestMiscTestingLibraryRules(t *testing.T) {
  source := `
import { cleanup, render, screen } from "@testing-library/react";
import { prettyDOM } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

function testCase() {
  const wrapper = render(<button data-testid="Bad Value">Save</button>);
  cleanup();
  screen.getByTestId("save");
  screen.getByText(/save/g);
  userEvent.click(screen.getByRole("button"));
  prettyDOM(document.body);
}
`
  resolver := InlineRuleResolver{
    Rules: RuleConfig{
      "testing-library/consistent-data-testid":          SeverityError,
      "testing-library/no-dom-import":                   SeverityError,
      "testing-library/no-global-regexp-flag-in-query":  SeverityError,
      "testing-library/no-manual-cleanup":               SeverityError,
      "testing-library/no-test-id-queries":              SeverityError,
      "testing-library/prefer-user-event-setup":         SeverityError,
      "testing-library/render-result-naming-convention": SeverityError,
    },
    Options: RuleOptionsMap{
      "testing-library/consistent-data-testid": json.RawMessage(`{"testIdPattern":"^[a-z-]+$"}`),
    },
  }
  assertTestingLibraryFindingsWithResolver(t, source, resolver, []ruleExpectation{
    {Rule: "testing-library/no-dom-import", Severity: SeverityError, Line: 3},
    {Rule: "testing-library/consistent-data-testid", Severity: SeverityError, Line: 7},
    {Rule: "testing-library/render-result-naming-convention", Severity: SeverityError, Line: 7},
    {Rule: "testing-library/no-manual-cleanup", Severity: SeverityError, Line: 8},
    {Rule: "testing-library/no-test-id-queries", Severity: SeverityError, Line: 9},
    {Rule: "testing-library/no-global-regexp-flag-in-query", Severity: SeverityError, Line: 10},
    {Rule: "testing-library/prefer-user-event-setup", Severity: SeverityError, Line: 11},
  })
}
