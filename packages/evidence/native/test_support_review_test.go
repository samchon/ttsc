package evidence

import (
  "testing"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// runReviewRule drives the review rule with no options, the only form the host
// ever delivers: the rule declares `AcceptsTtscLintOptions() false`, so a
// configured options object is refused at engine construction and Check never
// runs against one.
func runReviewRule(t *testing.T, path string, content string) []string {
  t.Helper()
  file := parseTestSourceFile(t, path, content)
  reporter := &capturedFileReporter{}
  reviewRule{}.Check(
    rule.NewContext(file, nil, rule.SeverityError, nil, reporter),
    file.AsNode(),
  )
  return reporter.messages
}
