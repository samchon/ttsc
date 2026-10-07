package linthost

import "testing"

// TestSetEnvReplacesOrAppends verifies environment overlays are deterministic.
//
// JavaScript config loading builds a node subprocess environment. setEnv is the
// helper used to update NODE_PATH. It replaces the first exact-key entry or
// appends an absent key; these inputs do not test pre-existing duplicate keys.
//
// This scenario covers both branches directly because command-level tests only
// observe the final subprocess behavior.
//
// 1. Replace an existing KEY entry in an environment slice.
// 2. Append a missing NEXT entry to the same slice.
// 3. Assert ordering and values stay stable.
//
// @evidence contracts/testing.md#behavioral-verification setEnv replaces only an exact existing key, appends a missing key, and retains unrelated entries and deterministic order.
// @evidence contracts/testing.md#independent-expectations Literal key=value strings and expected slice positions follow the environment-overlay contract rather than generating expected output with setEnv.
// @evidence contracts/testing.md#distinguishing-cases Existing and absent keys contrast; empty input and a longer KEY_OTHER prefix must not be confused with the target KEY.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Four authored environment-array transitions call setEnv directly in the shared Go process; returned entries and order observe replacement and insertion without changing the real process environment or starting a child.
func TestSetEnvReplacesOrAppends(t *testing.T) {
  replaced := setEnv([]string{"A=1", "KEY=old"}, "KEY", "new")
  if len(replaced) != 2 || replaced[0] != "A=1" || replaced[1] != "KEY=new" {
    t.Fatalf("replace mismatch: %v", replaced)
  }
  appended := setEnv(replaced, "NEXT", "value")
  if len(appended) != 3 || appended[2] != "NEXT=value" {
    t.Fatalf("append mismatch: %v", appended)
  }

  if got := setEnv(nil, "KEY", "value"); len(got) != 1 || got[0] != "KEY=value" {
    t.Fatalf("empty overlay mismatch: %v", got)
  }
  prefixed := setEnv([]string{"KEY_OTHER=keep"}, "KEY", "value")
  if len(prefixed) != 2 || prefixed[0] != "KEY_OTHER=keep" || prefixed[1] != "KEY=value" {
    t.Fatalf("distinct prefix key was overwritten: %v", prefixed)
  }
}
