package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestVitestValidDescribeCallbackReportsAsyncCallback verifies vitest/valid-describe-callback rejects async describes.
//
// Describe callbacks define suite structure and must run synchronously. This
// locks the callback extraction and async modifier check for describe blocks.
//
// 1. Parse an async describe callback.
// 2. Enable vitest/valid-describe-callback.
// 3. Assert one diagnostic is emitted.
func TestVitestValidDescribeCallbackReportsAsyncCallback(t *testing.T) {
  file := parseTS(t, `describe("suite", async () => {
  test("case", () => expect(value).toBe(1));
});
`)
  findings := NewEngine(RuleConfig{"vitest/valid-describe-callback": SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("expected one finding, got %v", findingRules(findings))
  }
}
