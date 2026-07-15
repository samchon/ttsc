package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestSecurityBindingsCollectedOncePerFile verifies the whole-file security
// binding table is built once per file, not once per visited call node.
//
// Every `security/*` rule consulted `collectSecurityBindings(ctx.File)` inside
// its per-node Check, so a file holding C call expressions rebuilt the
// identical file-invariant table C times — an O(C) stack of full-file walks
// that made the family O(nodes^2). Memoized on the shared per-file table the
// walk must run exactly once per file, independent of the call-node count and
// of how many `security/*` rules are enabled (they all read one table). The
// embedded `require(command)` gives a second rule a node it would also collect
// on, so a regression to per-rule caches would double the count instead of
// keeping it at one-per-file.
//
//  1. Build three files with wildly different call-node counts (50/500/2000).
//  2. Run two security rules over them with the walk counter zeroed.
//  3. Assert the collector ran once per file (== file count), never per call.
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
