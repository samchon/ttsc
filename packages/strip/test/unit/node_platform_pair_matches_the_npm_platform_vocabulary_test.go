package strip_test

import (
  "runtime"
  "testing"
)

// TestNodePlatformPairMatchesTheNpmPlatformVocabulary verifies the Go build
// target maps onto the names npm spells a platform package with.
//
// The compiler resolution asks for `@typescript/typescript-<platform>-<arch>`,
// a name npm publishes in `process.platform` / `process.arch` spelling. Go says
// `windows` and `amd64` where Node says `win32` and `x64`, so a missed mapping
// resolves nothing on every Windows or x64 host while every fixture built from
// the same function keeps agreeing with itself. Expectations come from Node's
// documented values and the platform package names in
// packages/ttsc/build/platform-package.cjs, not from this function's own output.
//
//  1. Map every target the workspace publishes a platform package for.
//  2. Assert the divergent members are translated and the rest pass through.
//  3. Assert the host's own pair no longer carries the Go spellings windows,
//     amd64 or 386, so fixtures built from it stay honest.
//
// @evidence contracts/testing.md#behavioral-verification Calls stripNodePlatformPairFor for explicit OS/architecture pairs and checks literal npm names, then excludes untranslated windows, amd64 and 386 in the runtime wrapper result.
// @evidence contracts/testing.md#independent-expectations The independent table uses npm win32, sunos, x64, ia32 and ppc64 spellings and preserves other names. It does not derive answers from platform fixture helpers.
// @evidence contracts/testing.md#distinguishing-cases Owns Windows/macOS/Linux architectures, Solaris, ppc64le and FreeBSD/s390x passthrough. The runtime wrapper assertion excludes known untranslated names only.
// @evidence contracts/testing.md#execution-ownership Unit entry TestNodePlatformPairMatchesTheNpmPlatformVocabulary is selected from test/unit by the utility runner unit overlay. Runs stripNodePlatformPairFor and stripNodePlatformPair in the Go process with literal inputs; no install, artifact or subprocess is needed.
func TestNodePlatformPairMatchesTheNpmPlatformVocabulary(t *testing.T) {
  cases := []struct{ goos, goarch, platform, arch string }{
    {"windows", "amd64", "win32", "x64"},
    {"windows", "arm64", "win32", "arm64"},
    {"darwin", "amd64", "darwin", "x64"},
    {"darwin", "arm64", "darwin", "arm64"},
    {"linux", "amd64", "linux", "x64"},
    {"linux", "arm64", "linux", "arm64"},
    {"linux", "arm", "linux", "arm"},
    {"linux", "386", "linux", "ia32"},
    {"linux", "ppc64le", "linux", "ppc64"},
    {"solaris", "amd64", "sunos", "x64"},
    // Neither vocabulary renames these, so they must pass through unchanged
    // rather than fall into a default branch that invents a name.
    {"freebsd", "s390x", "freebsd", "s390x"},
  }
  for _, testCase := range cases {
    platform, arch := stripNodePlatformPairFor(testCase.goos, testCase.goarch)
    if platform != testCase.platform || arch != testCase.arch {
      t.Fatalf(
        "stripNodePlatformPairFor(%q, %q) = (%q, %q), want (%q, %q)",
        testCase.goos, testCase.goarch,
        platform, arch,
        testCase.platform, testCase.arch,
      )
    }
  }

  platform, arch := stripNodePlatformPair()
  if platform == "windows" || arch == "amd64" || arch == "386" {
    t.Fatalf(
      "stripNodePlatformPair() = (%q, %q) on GOOS=%s GOARCH=%s: still Go spelling",
      platform, arch, runtime.GOOS, runtime.GOARCH,
    )
  }
}
