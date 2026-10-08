package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestConfigGlobPreservesStoredCaseRecovery verifies selector matching still
// observes missing, created and renamed paths instead of caching their spelling.
//
// A case alias is usable only when the actual temporary volume resolves it.
// Character classes retain their original range during that lookup; the
// underscore is admitted by A-z but excluded by a-z.
//
// 1. Reject an absent miscased alias, then create its canonical file.
// 2. Compare stored-case matching with the volume's actual alias capability.
// 3. Rename the directory away and back, checking rejection and recovery.
//
// @evidence contracts/testing.md#behavioral-verification Actual matchAnyPattern observes an absent alias, creation, directory rename and recreation; canonical positive/negative class predicates always run and miscased expectations use actual os.Stat alias availability.
// @evidence contracts/testing.md#independent-expectations The literal underscore belongs to A-z but not a-z; absence and rename remove the original alias, while os.Stat independently establishes whether an existing uppercase spelling reaches the authored file. No OS-name assumption determines case policy.
// @evidence contracts/testing.md#distinguishing-cases Brace alternatives and class ranges cover canonical positive/negative twins, absent/created/removed/recovered aliases and neighboring renamed directories. Both case-sensitive and case-insensitive volumes retain their actual behavior without skipping the whole case.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit uses an isolated temporary directory and the native filesystem matcher in-process; the test owns both renames, with no watchers, product process, build or installed consumer.
func TestConfigGlobPreservesStoredCaseRecovery(t *testing.T) {
  root := t.TempDir()
  canonical := filepath.Join(root, "src", "_directory", "index.ts")
  alias := filepath.Join(root, "SRC", "_DIRECTORY", "index.ts")
  patterns := []string{"{src,test}/[A-z]directory/**"}
  if matchAnyPattern(root, patterns, alias) { t.Error("absent case alias matched") }
  writeFile(t, canonical, "export {};\n")
  if !matchAnyPattern(root, patterns, canonical) { t.Error("canonical underscore path missed A-z") }
  if matchAnyPattern(root, []string{"{src,test}/[a-z]directory/**"}, canonical) { t.Error("underscore matched a-z") }
  _, err := os.Stat(alias)
  aliasExists := err == nil
  if err != nil && !os.IsNotExist(err) { t.Fatalf("observe alias: %v", err) }
  if got := matchAnyPattern(root, patterns, alias); got != aliasExists { t.Errorf("created alias: got %v, actual alias exists=%v", got, aliasExists) }
  directory := filepath.Dir(canonical)
  neighbor := filepath.Join(root, "src", "_neighbor")
  if err := os.Rename(directory, neighbor); err != nil { t.Fatal(err) }
  if matchAnyPattern(root, patterns, alias) { t.Error("removed alias retained cached spelling") }
  if matchAnyPattern(root, patterns, filepath.Join(neighbor, "index.ts")) { t.Error("neighbor directory matched original selector") }
  if err := os.Rename(neighbor, directory); err != nil { t.Fatal(err) }
  if got := matchAnyPattern(root, patterns, alias); got != aliasExists { t.Errorf("recovered alias: got %v want %v", got, aliasExists) }
}
