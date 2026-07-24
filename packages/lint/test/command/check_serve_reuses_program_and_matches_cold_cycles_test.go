package linthost

import (
  "bytes"
  "path/filepath"
  "strings"
  "testing"
)

// TestCheckServeReusesProgramAndMatchesColdCycles verifies check-serve keeps one
// Program only across changes that preserve compiler topology.
//
// Residency is sound only if an incremental answer equals the established
// one-shot command, request-owned rule/reporting state is rebuilt, external
// data does not evict the Program, and a new TypeScript root does. The load and
// update counters are product telemetry, not a test-only hook.
//
//  1. Run an initial failing no-var cycle and observe one Program load.
//  2. Edit the known source, apply it incrementally, and compare the clean
//     resident result byte-for-byte with a cold check of the same filesystem.
//  3. Reintroduce the finding and compare the failing incremental and cold
//     diagnostics byte-for-byte.
//  4. Apply a declared external JSON change and assert the Program stays warm.
//  5. Add an unknown TypeScript root and assert the next cycle fully reloads.
func TestCheckServeReusesProgramAndMatchesColdCycles(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nJSON.stringify(legacy);\n")
  seedLintRules(t, root, map[string]string{"no-var": "error"})
  base, err := parseSubcommandFlagsWithIO(
    "check-serve",
    []string{
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    },
    nil,
    nil,
  )
  if err != nil {
    t.Fatal(err)
  }
  base.noEmit = true
  state := &residentCheckState{}
  defer state.close()

  first := state.run(base)
  if first.Status != 2 ||
    first.Telemetry.ProgramLoads != 1 ||
    first.Telemetry.Reused ||
    !strings.Contains(first.Stderr, "[no-var]") {
    t.Fatalf("initial resident cycle = %#v", first)
  }

  source := filepath.Join(root, "src", "main.ts")
  writeFile(t, source, "const modern = 1;\nJSON.stringify(modern);\n")
  state.apply(serveCheckRequest{Changed: []string{source}})
  incremental := state.run(base)
  var coldOut bytes.Buffer
  var coldErr bytes.Buffer
  coldCode := RunCheckWithIO(
    []string{
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    },
    &coldOut,
    &coldErr,
  )
  if incremental.Status != coldCode ||
    incremental.Stdout != coldOut.String() ||
    incremental.Stderr != coldErr.String() {
    t.Fatalf(
      "incremental/cold mismatch\nresident=%#v\ncold=(%d,%q,%q)",
      incremental,
      coldCode,
      coldOut.String(),
      coldErr.String(),
    )
  }
  if incremental.Telemetry.ProgramLoads != 1 ||
    incremental.Telemetry.ProgramUpdates != 1 ||
    !incremental.Telemetry.Reused {
    t.Fatalf("incremental telemetry = %#v", incremental.Telemetry)
  }

  writeFile(t, source, "var legacy = 1;\nJSON.stringify(legacy);\n")
  state.apply(serveCheckRequest{Changed: []string{source}})
  failing := state.run(base)
  coldOut.Reset()
  coldErr.Reset()
  coldCode = RunCheckWithIO(
    []string{
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    },
    &coldOut,
    &coldErr,
  )
  if failing.Status != coldCode ||
    failing.Stdout != coldOut.String() ||
    failing.Stderr != coldErr.String() {
    t.Fatalf(
      "failing incremental/cold mismatch\nresident=%#v\ncold=(%d,%q,%q)",
      failing,
      coldCode,
      coldOut.String(),
      coldErr.String(),
    )
  }
  if failing.Telemetry.ProgramLoads != 1 ||
    failing.Telemetry.ProgramUpdates != 2 ||
    !failing.Telemetry.Reused {
    t.Fatalf("failing incremental telemetry = %#v", failing.Telemetry)
  }

  external := filepath.Join(root, "openapi.json")
  writeFile(t, external, `{"openapi":"3.1.0"}`)
  state.apply(serveCheckRequest{
    Changed:  []string{external},
    External: []string{external},
  })
  externalCycle := state.run(base)
  if externalCycle.Telemetry.ProgramLoads != 1 ||
    !externalCycle.Telemetry.Reused {
    t.Fatalf("external cycle telemetry = %#v", externalCycle.Telemetry)
  }

  added := filepath.Join(root, "src", "added.ts")
  writeFile(t, added, "export const added = true;\n")
  state.apply(serveCheckRequest{Changed: []string{added}})
  reloaded := state.run(base)
  if reloaded.Telemetry.ProgramLoads != 2 ||
    reloaded.Telemetry.Reused {
    t.Fatalf("topology reload telemetry = %#v", reloaded.Telemetry)
  }
}
