package linthost

import (
  "path/filepath"
  "strings"
  "testing"
)

// TestConfigGlobPreservesExpansionSemantics verifies alternatives are expanded
// before slash splitting and native component tokenization.
//
// A brace can form a bracket class, escape or globstar together with its
// neighbors. Invalid alternatives must not reject valid siblings. The small
// reference walks authored concrete alternatives using filepath.Match; it does
// not construct the compact graph or determine its matching states.
//
// 1. Compare native component patterns against filepath.Match on a fixed corpus.
// 2. Compare authored brace expansion lists, including malformed and empty branches.
// 3. Exercise globstar boundaries and alternatives with different continuations.
//
// @evidence contracts/testing.md#behavioral-verification Actual matchGlob is compared with native filepath.Match component results and an exhaustive small path-partition reference over authored concrete expansions; literal boundary results cover empty selectors and zero-component globstars.
// @evidence contracts/testing.md#independent-expectations Concrete expansion lists are authored independently of the graph builder; filepath.Match supplies native class, escape, byte/rune and invalid-pattern semantics. The reference enumerates small globstar partitions and is not the compact matcher. It proves behavior on this corpus, not general work bounds.
// @evidence contracts/testing.md#distinguishing-cases Positive/negative names cover nested, adjacent, singleton, empty, malformed and slash braces, syntax assembled across branches, invalid/valid siblings, Unicode and invalid UTF-8, separators, repeated stars and globstar zero/one/many components; branch-specific suffixes detect switching alternatives after wildcard consumption.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit calls the owning matcher and standard-library oracle in-process on authored strings; no filesystem fixture, compiler host, installation or product child executes.
func TestConfigGlobPreservesExpansionSemantics(t *testing.T) {
  names := []string{"a", "b", "c", "aa", "ab", "ba", "bb", "abc", "ab]", "ac", "bc", "x", "x.ts", "a.ts", "b.ts", "a.js", ".hidden", "_", "-", "]", "[", "*", "?", "\\", "\\a", "a\\b", "é", "界", "éa", "aé", string([]byte{0xff}), string([]byte{'a', 0xff})}
  native := []string{"a", "*", "?", "??", "***", "*a", "a*", "*a*b", "a?", "?a", "[ab]", "[^ab]", "[a-c]", "[c-a]", "[A-z]", "[[]", "[\\]]", "[\\-]", "[a-]", "[]", "[^]", "[", "[a", "[a\\]", "[é界]", "[é-界]", "\\*", "\\?", "\\", "a\\b", "é?", "?é", "*é", "["+string([]byte{0xff})+"]"}
  names = append(names, "\u00f1", "\U00010000", "\U00011000")
  native = append(native, "*[ab]", "*[ab]*a", "*[a-c]?", "[^a-c]*[ab]", "[\U00010000-\U00011000]", "?\U00010000", "*\U00010000")
  for _, pattern := range native {
    for _, name := range names {
      want, err := filepath.Match(pattern, name)
      want = want && err == nil
      for _, selector := range []string{pattern, "{"+pattern+"}"} {
        if got := matchGlob(selector, name); got != want {
          t.Errorf("native selector=%q pattern=%q name=%q: got %v, filepath.Match=%v error=%v", selector, pattern, name, got, want, err)
        }
      }
    }
  }
  cases := []struct { pattern string; expanded []string }{
    {"{a,b}", []string{"a", "b"}},
    {"{a,{b,c}}{,x}", []string{"a", "ax", "b", "bx", "c", "cx"}},
    {"{a}", []string{"a"}},
    {"{}", []string{""}},
    {"{,a,}", []string{"", "a", ""}},
    {"{a,b}{c,d}.ts", []string{"ac.ts", "ad.ts", "bc.ts", "bd.ts"}},
    {"{a,{b,c}", []string{"{a,{b,c}"}},
    {"x{a,b}y{c", []string{"xay{c", "xby{c"}},
    {"x}y{a,b}", []string{"x}ya", "x}yb"}},
    {"{[,a}b{],c}", []string{"[b]", "[bc", "ab]", "abc"}},
    {"[{a-c,x}]", []string{"[a-c]", "[x]"}},
    {"[{^,}a]", []string{"[^a]", "[a]"}},
    {"[{],a}]", []string{"[]]", "[a]"}},
    {"[\xc3{\xa9,\xb1}]", []string{"[\xc3\xa9]", "[\xc3\xb1]"}},
    {"[\xc3{\xa9,a}]", []string{"[\xc3\xa9]", "[\xc3a]"}},
    {"[\xf0{\x90,\x91}\x80\x80]", []string{"[\xf0\x90\x80\x80]", "[\xf0\x91\x80\x80]"}},
    {"{\\,a}{*,b}", []string{"\\*", "\\b", "a*", "ab"}},
    {"\\{a,b}", []string{"\\a", "\\b"}},
    {"{*c,ab}", []string{"*c", "ab"}},
    {"{**/a,b}", []string{"**/a", "b"}},
    {"{*,a}{*,b}/x.ts", []string{"**/x.ts", "*b/x.ts", "a*/x.ts", "ab/x.ts"}},
    {"{src/,test/}*.ts", []string{"src/*.ts", "test/*.ts"}},
    {"{src/a,src/b}.ts", []string{"src/a.ts", "src/b.ts"}},
    {"{/,a}", []string{"/", "a"}},
    {"{a/,b}", []string{"a/", "b"}},
    {"{[,a/b}c{],/d}", []string{"[c]", "[c/d", "a/bc]", "a/bc/d"}},
    {"**/a/**/b", []string{"**/a/**/b"}},
    {"***/*.ts", []string{"***/*.ts"}},
    {"a//b", []string{"a//b"}},
  }
  paths := append(append([]string{}, names...), "", "xxab", "xxb", "a/x.ts", "x.ts", "ab/x.ts", "src/a.ts", "src/x.ts", "test/b.ts", "else/x.ts", "x/y/x.ts", "a/b", "x/a/y/b", "a//b", "a/bc]", "a/bc/d", "x/y/z.ts")
  for _, row := range cases {
    for _, name := range paths {
      want := false
      for _, concrete := range row.expanded {
        want = want || referenceConfigGlobParts(strings.Split(concrete, "/"), configGlobReferenceName(name))
      }
      if got := matchGlob(row.pattern, name); got != want {
        t.Errorf("brace pattern=%q name=%q expansions=%q: got %v want %v", row.pattern, name, row.expanded, got, want)
      }
    }
  }
  for _, row := range []struct { pattern, name string; want bool }{
    {"", "", true}, {"///", "/", true}, {"", "a", false}, {"{}", "", false},
    {"**", "", true}, {"**/a", "a", true}, {"a/**", "a", true},
    {"a/**/b", "a/b", true}, {"a/**/b", "a/x/y/b", true}, {"a/**/b", "a/x/c", false},
    {"***", "a/b", false}, {"{*c,ab}", "xxab", false}, {"{**/a,b}", "xx/b", false},
    {"/{a,b}/", "/a/", true},
  } {
    if got := matchGlob(row.pattern, row.name); got != row.want {
      t.Errorf("boundary pattern=%q name=%q: got %v want %v", row.pattern, row.name, got, row.want)
    }
  }
}

func configGlobReferenceName(name string) []string {
  name = strings.Trim(name, "/")
  if name == "" { return nil }
  return strings.Split(name, "/")
}

func referenceConfigGlobParts(pattern, name []string) bool {
  if len(pattern) == 0 { return len(name) == 0 }
  if pattern[0] == "**" {
    for consumed := 0; consumed <= len(name); consumed++ {
      if referenceConfigGlobParts(pattern[1:], name[consumed:]) { return true }
    }
    return false
  }
  if len(name) == 0 { return false }
  matched, err := filepath.Match(pattern[0], name[0])
  return err == nil && matched && referenceConfigGlobParts(pattern[1:], name[1:])
}
