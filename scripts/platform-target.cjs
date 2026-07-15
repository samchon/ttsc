// Coherent Go build target for one `@ttsc/{os}-{arch}` platform package.
//
// A single record ties the executable build environment (`GOOS`, `GOARCH`,
// `GOARM`) to the bundled Go SDK archive suffix so the two cannot drift onto
// different CPU baselines. The linux-arm package bundles the `linux-armv6l`
// SDK, so its executables must also be built for ARMv6: without an explicit
// `GOARM` the toolchain defaults to ARMv7 and emits executables that the ARMv6
// baseline is not guaranteed to run. Keeping the archive suffix derived from
// the same record makes that ARMv6 contract the one source of truth.

/**
 * @param {"linux"|"darwin"|"win32"} npmOs
 * @param {"x64"|"arm"|"arm64"} npmArch
 * @returns {{ goos: string, goarch: string, goarm: string|undefined, archiveArch: string, archiveTarget: string }}
 */
function resolveGoTarget(npmOs, npmArch) {
  const goos = npmOs === "win32" ? "windows" : npmOs;
  const goarch = npmArch === "x64" ? "amd64" : npmArch;
  // Only the 32-bit `arm` package pins an ARM sub-architecture. `arm64` (ARMv8)
  // carries no GOARM, and non-ARM targets never set it.
  const goarm = npmArch === "arm" ? "6" : undefined;
  const archiveArch = goarm ? `armv${goarm}l` : goarch;
  return {
    goos,
    goarch,
    goarm,
    archiveArch,
    archiveTarget: `${goos}-${archiveArch}`,
  };
}

module.exports = { resolveGoTarget };
