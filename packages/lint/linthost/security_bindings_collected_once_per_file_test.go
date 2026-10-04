package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestSecurityBindingsCollectedOncePerFile verifies the whole-file security
// binding table is built once per file, not once per visited call node.
//
// The two enabled rules read the shared per-file binding table. The authored
// call populations expose repeated collection by call or by enabled reader:
// require(command) makes the second rule consult the table alongside the exec
// calls. The counter records collector entries; the expected three entries
// establish sharing for these inputs, without measuring elapsed time or every
// security rule configuration.
//
//  1. Build three files with wildly different call-node counts (50/500/2000).
//  2. Run two security rules over them with the walk counter zeroed.
//  3. Assert the collector ran once per file (== file count), never per call.
//
// @evidence contracts/testing.md#behavioral-verification Engine.Run shares the security binding scan across detect-child-process and detect-non-literal-require on each file. The atomic counter distinguishes repeated whole-file walks.
// @evidence contracts/testing.md#independent-expectations Three source files require exactly three binding scans independently of their authored 50, 500 and 2000 exec calls. Findings must remain nonempty, but this test does not establish each finding location.
// @evidence contracts/testing.md#distinguishing-cases Different call populations and two enabled readers expose per-node and per-rule caches; detailed reporting semantics are owned by the corpus fixture security-detect-child-process.ts and the corpus fixture security-detect-non-literal-require.ts.
// @evidence contracts/testing.md#execution-ownership parseTSFile creates the three authored call-population ASTs; NewEngine.Run executes the two rules serially after resetting securityBindingsCollectCount. This entry owns the file-count oracle and nonempty findings, with no benchmark or host process.
func TestSecurityBindingsCollectedOncePerFile(t *testing.T) {
  makeFile := func(name string, calls int) *shimast.SourceFile {
    var sb strings.Builder
    sb.WriteString("import child from \"child_process\";\n")
    sb.WriteString("const command = String(Math.random());\n")
    sb.WriteString("require(command);\n")
    for i := 0; i < calls; i++ {
      sb.WriteString("child.exec(command);\n")
    }
    return parseTSFile(t, name, sb.String())
  }
  files := []*shimast.SourceFile{
    makeFile("/virtual/security-scale-a.ts", 50),
    makeFile("/virtual/security-scale-b.ts", 500),
    makeFile("/virtual/security-scale-c.ts", 2000),
  }
  totalCallNodes := 50 + 500 + 2000

  engine := NewEngine(RuleConfig{
    "security/detect-child-process":       SeverityError,
    "security/detect-non-literal-require": SeverityError,
  })
  engine.SetSerial(true)

  securityBindingsCollectCount.Store(0)
  findings := engine.Run(files, nil)
  if len(findings) == 0 {
    t.Fatalf("expected the security rules to fire on the dynamic exec/require calls")
  }
  if got := securityBindingsCollectCount.Load(); got != int64(len(files)) {
    t.Fatalf(
      "collectSecurityBindings ran %d times over %d files (%d total call nodes); want %d — the file-invariant walk must be O(files), not O(call-nodes)",
      got, len(files), totalCallNodes, len(files),
    )
  }
}
