package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsCustomStatsDiscovery verifies the
// custom-stats path: a `> 0% in my stats` query resolves against a sibling
// `browserslist-stats.json`, both when the query comes from `.browserslistrc`
// discovery and when it is supplied through the `targets` option.
//
// `chrome 80` supports `Object.assign` but not `Array#toSorted`, so the stats
// query must reproduce exactly the `{chrome: 80}` decision for both — proving
// it resolves to that browser rather than to an empty (vacuously-available)
// target list. A port that dropped custom-stats support would either
// under-report or over-report.
//
//  1. Discover the query from `.browserslistrc` + stats file: `object-assign`
//     reports, `array/to-sorted` stays silent.
//  2. Supply the same query through the option with only the stats file: same
//     positive/negative split.
// @evidence contracts/testing.md#behavioral-verification The actual rule resolves sibling custom statistics from both discovered configuration and explicit query options, distinguishing Chrome 80 from an empty-target fallback.
// @evidence contracts/testing.md#independent-expectations Chrome 80 supports Object.assign but still needs Array#toSorted; these independently chosen feature boundaries require opposite outcomes for one population.
// @evidence contracts/testing.md#distinguishing-cases Both query origins report object-assign and retain core-js/features/array/to-sorted without a report; feature and query origin vary while the population stays identical.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsCustomStatsDiscovery owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsCustomStatsDiscovery(t *testing.T) {
  stats := "{\"chrome\":{\"80\":1}}"
  const stillNeeded = `require("core-js/features/array/to-sorted")`

  assertProjectReports(t, map[string]string{
    ".browserslistrc":         "> 0% in my stats\n",
    "browserslist-stats.json": stats,
  }, "index.ts", `require("object-assign")`, "", polyfillMessageBuiltIn)
  assertProjectClean(t, map[string]string{
    ".browserslistrc":         "> 0% in my stats\n",
    "browserslist-stats.json": stats,
  }, "index.ts", stillNeeded, "")

  assertProjectReports(t, map[string]string{
    "browserslist-stats.json": stats,
  }, "index.ts", `require("object-assign")`, `{"targets":"> 0% in my stats"}`, polyfillMessageBuiltIn)
  assertProjectClean(t, map[string]string{
    "browserslist-stats.json": stats,
  }, "index.ts", stillNeeded, `{"targets":"> 0% in my stats"}`)
}
