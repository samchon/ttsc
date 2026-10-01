package linthost

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
// documented values and the `@ttsc/{os}-{arch}` package names in
// packages/ttsc/build/platform-package.cjs, not from this function's own output.
//
//  1. Map every target the workspace publishes a platform package for.
//  2. Assert the divergent members are translated and the rest pass through.
//  3. Assert the host pair does not retain the renamed Go spellings.
//
// @evidence contracts/testing.md#behavioral-verification nodePlatformPairFor maps Go platform and architecture spellings to npm package vocabulary and nodePlatformPair never leaks the renamed host spellings.
// @evidence contracts/testing.md#independent-expectations The authored table follows process.platform/process.arch spellings including win32, sunos, x64, ia32 and ppc64, independent of the mapping implementation.
// @evidence contracts/testing.md#distinguishing-cases Renamed OS and architectures contrast with unchanged arm/arm64 and unknown freebsd/s390x passthrough; cross-product cases cover Windows, Darwin and Linux.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Eleven literal Go/npm target pairs reach nodePlatformPairFor and the native host pair reaches nodePlatformPair in-process; mapping is observed without cross-compilation or an OS matrix.
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
    platform, arch := nodePlatformPairFor(testCase.goos, testCase.goarch)
    if platform != testCase.platform || arch != testCase.arch {
      t.Fatalf(
        "nodePlatformPairFor(%q, %q) = (%q, %q), want (%q, %q)",
        testCase.goos, testCase.goarch,
        platform, arch,
        testCase.platform, testCase.arch,
      )
    }
  }

  platform, arch := nodePlatformPair()
  if platform == "windows" || arch == "amd64" || arch == "386" {
    t.Fatalf(
      "nodePlatformPair() = (%q, %q) on GOOS=%s GOARCH=%s: still Go spelling",
      platform, arch, runtime.GOOS, runtime.GOARCH,
    )
  }
}
