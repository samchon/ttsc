package main

import "testing"

// Verifies the reachability scan reads linkname targets of the audited
// compiler target only.
//
// The TypeScript 7.1 bridges link into github.com/microsoft/TypeScript/tsc,
// while the 7.0 shims link into typescript-go. Recognizing the other target's
// links would mark symbols reachable that the audited shims cannot name.
//
//  1. Build the scanner for the 7.1 internal prefix and match a 7.1 method link
//     and a nested-package function link.
//  2. Require both scanners to reject a link into the other compiler.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production newLinknameRe and asserts the captured package suffix and symbol, or the absence of a match, for each line.
// @evidence contracts/testing.md#independent-expectations The expected suffixes and names are written beside literal linkname lines taken from the two compilers' module paths.
// @evidence contracts/testing.md#distinguishing-cases A receiver method and a nested-package function must match under 7.1, and each target's scanner must reject the other compiler's otherwise identical link; TestLinknameRe owns the remaining 7.0 shapes.
// @evidence contracts/testing.md#execution-ownership This tools/shim_audit unit compiles regular expressions in process; it loads no package and starts no process.
func TestLinknameTargetsFollowTheAuditedCompiler(t *testing.T) {
  const tsc = "github.com/microsoft/TypeScript/tsc/internal/"
  scanner := newLinknameRe(tsc)
  for _, c := range []struct{ line, pkg, name string }{
    {"//go:linkname checkerGetMinArgumentCount " + tsc + "checker.(*Checker).getMinArgumentCount", "checker", "getMinArgumentCount"},
    {"//go:linkname From " + tsc + "vfs/cachedvfs.From", "vfs/cachedvfs", "From"},
  } {
    m := scanner.FindStringSubmatch(c.line)
    if m == nil || m[1] != c.pkg || m[2] != c.name {
      t.Errorf("%q matched %v, want %s.%s", c.line, m, c.pkg, c.name)
    }
  }
  if m := scanner.FindStringSubmatch("//go:linkname From " + defaultInternalPrefix + "vfs/cachedvfs.From"); m != nil {
    t.Errorf("7.1 scanner matched a 7.0 link: %v", m)
  }
  if m := newLinknameRe(defaultInternalPrefix).FindStringSubmatch("//go:linkname From " + tsc + "vfs/cachedvfs.From"); m != nil {
    t.Errorf("7.0 scanner matched a 7.1 link: %v", m)
  }
}
