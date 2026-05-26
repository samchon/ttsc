package linthost

import (
  "encoding/json"
  "testing"
)

/**
 * Verifies testing-library miscellaneous rules: imports, cleanup, test ids, regex flags, setup, and naming.
 *
 * Covers the lower-level one-pass checks that do not need separate behavioral
 * fixtures. The configured data-testid option proves tuple options reach the
 * SourceFile-level rule through `Context.DecodeOptions`.
 *
 * 1. Mix DOM imports, cleanup, test-id queries/attributes, direct userEvent calls, and a render result name.
 * 2. Enable the corresponding single-pattern rules.
 * 3. Assert each rule reports once at the expected source line.
 */
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
