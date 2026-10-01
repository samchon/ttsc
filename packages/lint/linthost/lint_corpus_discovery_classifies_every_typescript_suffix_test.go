package linthost

import (
  "sort"
  "strings"
  "testing"
)

// TestLintCorpusDiscoveryClassifiesEveryTypeScriptSuffix verifies the loader
// recognizes every canonical TypeScript suffix and rejects case variants.
//
// A suffix omitted from discovery would bypass the classification contract as
// soon as a matching fixture is added. The compiler's wildcard scanner only
// recognizes canonical lowercase suffixes, so a case variant must fail loudly
// rather than be silently excluded from the program.
//
// 1. Write one entry per canonical suffix plus a JavaScript control.
// 2. Load the corpus and require exactly the TypeScript entries.
// 3. Add each uppercase-suffix file in turn and require a canonical-spelling error.
//
// @evidence contracts/testing.md#behavioral-verification loadLintCorpus is run on real trees: seven canonical suffixes load as entries, the JavaScript control is ignored, and every uppercase spelling makes loading fail naming the file.
// @evidence contracts/testing.md#independent-expectations The suffix vocabulary (.ts .tsx .mts .cts .d.ts .d.mts .d.cts) and its lowercase-only spelling come from the TypeScript compiler's source-file extensions, enumerated here as literals.
// @evidence contracts/testing.md#distinguishing-cases Each canonical suffix is a positive, the .js file a negative, and each of seven uppercase spellings an adjacent failure.
// @evidence contracts/testing.md#execution-ownership TestLintCorpusDiscoveryClassifiesEveryTypeScriptSuffix is a discoverable Go unit entry calling the loader over t.TempDir trees; it starts no compiler or host.
func TestLintCorpusDiscoveryClassifiesEveryTypeScriptSuffix(t *testing.T) {
  annotated := "// expect: fixture/rule error\nexport {};\n"
  canonical := []string{"case.ts", "case.tsx", "case.mts", "case.cts", "case.d.ts", "case.d.mts", "case.d.cts"}
  files := map[string]string{"ignored.js": "export {};\n"}
  for _, name := range canonical {
    files[name] = annotated
  }
  entries, err := loadLintCorpus(writeCorpusTree(t, files))
  if err != nil {
    t.Fatal(err)
  }
  var loaded []string
  for _, entry := range entries {
    loaded = append(loaded, entry.RelativeFile)
  }
  sort.Strings(loaded)
  sort.Strings(canonical)
  if strings.Join(loaded, ",") != strings.Join(canonical, ",") {
    t.Fatalf("loaded %v, want %v", loaded, canonical)
  }
  for _, name := range []string{
    "uppercase-ts.TS", "uppercase-tsx.TSX", "uppercase-mts.MTS", "uppercase-cts.CTS",
    "uppercase-dts.D.TS", "uppercase-dmts.D.MTS", "uppercase-dcts.D.CTS",
  } {
    files[name] = annotated
    _, err := loadLintCorpus(writeCorpusTree(t, files))
    if err == nil || !strings.Contains(err.Error(), name+": TypeScript source extension must use canonical lowercase spelling") {
      t.Fatalf("%s: want canonical-spelling error, got %v", name, err)
    }
    delete(files, name)
  }
}
