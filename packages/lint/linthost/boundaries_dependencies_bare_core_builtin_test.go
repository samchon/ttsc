package linthost

import "testing"

// TestBoundariesDependenciesClassifiesBareBuiltinsAsCore verifies Node
// built-ins keep the `core` origin without the `node:` scheme.
//
// Upstream derives origin from the platform module list, not from the
// specifier spelling. Classifying bare `fs` as external would let
// external-origin policies capture platform modules and leave core-origin
// policies silently unenforced for the unprefixed spelling.
//
// 1. Import the bare `fs` built-in and an external package with all origins on.
// 2. Deny external origins, then deny core origins.
// 3. Assert the built-in reports only under the core policy and the package only under external.
//
// @evidence contracts/testing.md#behavioral-verification Dependency classification treats bare fs as core and react as external when selecting origin policies.
// @evidence contracts/testing.md#independent-expectations Node fs is a core module despite lacking node: prefix, while react is an external package; literal targets reflect those independently known origins.
// @evidence contracts/testing.md#distinguishing-cases Two opposite policies on the same two imports expose collapsed external/core classification.
// @evidence contracts/testing.md#execution-ownership runBoundaryRule parses the same fs/react source and calls NewEngineWithResolver.Run twice, once for external and once for core policy. This entry owns both policy results in the Go process.
func TestBoundariesDependenciesClassifiesBareBuiltinsAsCore(t *testing.T) {
  const ruleName = "boundaries/dependencies"
  source := "import \"fs\";\nimport \"react\";\n"
  base := `"elements":[{"type":"app","pattern":"src/app/**"}],
    "default":"allow","checkAllOrigins":true`

  external := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,
    "policies":[{"from":"app","disallow":{"to":{"origin":"external"}}}]
  }`, nil)
  assertBoundaryFindingTexts(t, source, external, `"react"`)

  core := runBoundaryRule(t, ruleName, "src/app/main.ts", source, `{`+base+`,
    "policies":[{"from":"app","disallow":{"to":{"origin":"core"}}}]
  }`, nil)
  assertBoundaryFindingTexts(t, source, core, `"fs"`)
}
