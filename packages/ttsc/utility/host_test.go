package utility

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

func TestFilterHostArgsKeepsUtilityFlagsAndDropsHostOnlyFlags(t *testing.T) {
  got := filterHostArgs([]string{
    "--cwd", "/workspace/project",
    "--cache-dir", ".ttsc",
    "--emit",
    "--binary=/tmp/tsgo",
    "--plugins-json", "[]",
    "src/main.ts",
    "--",
    "--cwd", "ignored",
  })
  want := []string{
    "--cwd", "/workspace/project",
    "--emit",
    "--plugins-json", "[]",
    "src/main.ts",
  }
  if !equalStringSlices(got, want) {
    t.Fatalf("filtered args mismatch:\nwant: %#v\n got: %#v", want, got)
  }
}

func TestParseBannerFormatsAndSanitizesJSDoc(t *testing.T) {
  banner, err := parseBanner(map[string]any{
    "text": "first\r\nsecond */\n\n",
  }, t.TempDir(), "tsconfig.json")
  if err != nil {
    t.Fatal(err)
  }
  if !strings.Contains(banner, " * first\n * second * /\n") {
    t.Fatalf("banner was not normalized and sanitized:\n%s", banner)
  }
  if strings.Contains(banner, "second */") {
    t.Fatalf("banner must not preserve raw JSDoc terminator:\n%s", banner)
  }
  if !strings.HasSuffix(banner, "*/\n") {
    t.Fatalf("banner must end with a closed JSDoc block:\n%s", banner)
  }
}

func TestFindBannerConfigFileUsesTsconfigDirectoryWhenOutsideCwd(t *testing.T) {
  cwd := seedHostTestProject(t, map[string]string{
    "banner.config.cjs": `module.exports = { text: "cwd banner" };` + "\n",
  })
  wrapper := seedHostTestProject(t, map[string]string{
    "banner.config.cjs": `module.exports = { text: "wrapper banner" };` + "\n",
    "tsconfig.json":     "{}",
  })

  discovered, err := findBannerConfigFile(cwd, filepath.Join(wrapper, "tsconfig.json"))
  if err != nil {
    t.Fatalf("findBannerConfigFile: %v", err)
  }
  if discovered != filepath.Join(wrapper, "banner.config.cjs") {
    t.Fatalf("unexpected discovery path: %s", discovered)
  }
}

func TestResolveBannerTextRejectsEmptyObjectText(t *testing.T) {
  _, err := resolveBannerText(map[string]any{
    "text": "  ",
  }, t.TempDir(), "tsconfig.json")
  if err == nil || !strings.Contains(err.Error(), "non-empty string") {
    t.Fatalf("expected non-empty string error, got %v", err)
  }
}

func TestPathsRewriterResolvesIndexAndModuleExtensions(t *testing.T) {
  root := normalizePath(t.TempDir())
  source := normalizePath(filepath.Join(root, "src", "consumer", "main.ts"))
  index := normalizePath(filepath.Join(root, "src", "modules", "index.ts"))
  module := normalizePath(filepath.Join(root, "src", "modules", "esm.mts"))
  rewriter := &pathsRewriter{
    basePath: root,
    outDir:   normalizePath(filepath.Join(root, "dist")),
    rootDir:  normalizePath(filepath.Join(root, "src")),
    patterns: []pathsPattern{
      {pattern: "@lib/*", targets: []string{"src/modules/*"}},
    },
    sourceFiles: map[string]string{
      index:                             index,
      stripKnownSourceExtension(index):  index,
      module:                            module,
      stripKnownSourceExtension(module): module,
    },
  }

  rewritten, ok := rewriter.rewrite(source, "@lib")
  if ok || rewritten != "@lib" {
    t.Fatalf("non-matching pattern should stay unchanged, got %q ok=%v", rewritten, ok)
  }

  rewritten, ok = rewriter.rewrite(source, "@lib/index")
  if !ok || rewritten != "../modules/index.js" {
    t.Fatalf("index rewrite mismatch: %q ok=%v", rewritten, ok)
  }

  rewritten, ok = rewriter.rewrite(source, "@lib/esm")
  if !ok || rewritten != "../modules/esm.mjs" {
    t.Fatalf("module extension rewrite mismatch: %q ok=%v", rewritten, ok)
  }
}

func TestStripConfigurationDefaultsAndValidation(t *testing.T) {
  strip, err := parseStrip(map[string]any{})
  if err != nil {
    t.Fatal(err)
  }
  if !strip.stripDebugger || !strip.matchesCall("console.log") || !strip.matchesCall("assert.equal") {
    t.Fatalf("default strip config did not enable expected patterns: %#v", strip)
  }
  if strip.matchesCall("console.info") || strip.matchesCall("assert") {
    t.Fatalf("default strip config matched too broadly")
  }

  if _, err := parseStrip(map[string]any{"statements": []any{"debugger", "with"}}); err == nil {
    t.Fatal("unsupported statement pattern must fail")
  }
  if _, err := parseCallPattern("assert.*.deep"); err == nil {
    t.Fatal("middle wildcard call pattern must fail")
  }
}

func TestSourceExtensionHelpersPreferCompoundExtensions(t *testing.T) {
  cases := map[string]string{
    "types.d.ts":     "types",
    "types.d.mts":    "types",
    "module.test.ts": "module.test",
    "entry.jsx":      "entry",
  }
  for input, want := range cases {
    t.Run(input, func(t *testing.T) {
      if got := stripKnownSourceExtension(input); got != want {
        t.Fatalf("stripKnownSourceExtension(%q) = %q, want %q", input, got, want)
      }
    })
  }
}

func seedHostTestProject(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for name, text := range files {
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}
