package linthost

import (
  "encoding/json"
  "path/filepath"
  "testing"
)

type formatApplicabilityFile struct {
  name   string
  source string
  want   string
}

// TestCommandFormatRespectsResolvedEntryApplicability exercises entry scope
// through the real command loader. loadRules wraps ConfigStore before format
// mode sees it, so these cases also prevent an outer resolver from duplicating
// glob logic through a concrete-type assertion.
func TestCommandFormatRespectsResolvedEntryApplicability(t *testing.T) {
  t.Run("ignore_only_keeps_defaults_for_unignored_files", func(t *testing.T) {
    files := []formatApplicabilityFile{
      {name: "src/ignored.ts", source: "const ignored = 1\n", want: "const ignored = 1\n"},
      {name: "src/included.ts", source: "const included = 2\n", want: "const included = 2;\n"},
    }
    root := seedFormatApplicabilityProject(t, files)
    seedLintConfig(t, root, map[string]any{
      "ignores": []string{"src/ignored.ts"},
    })
    assertFormatApplicability(t, root, files)

    ignored := resolveFormatApplicability(t, root, "src/ignored.ts")
    if !ignored.Ignored || ignored.OutOfScope {
      t.Fatalf("normal resolution lost global ignore state: %+v", ignored)
    }
    included := resolveFormatApplicability(t, root, "src/included.ts")
    if included.Ignored || included.OutOfScope {
      t.Fatalf("normal resolution excluded unignored file: %+v", included)
    }
    assertLSPFormatApplicability(t, root, files)
  })

  t.Run("scoped_base_ignore_keeps_global_child_format", func(t *testing.T) {
    files := []formatApplicabilityFile{
      {name: "src/generated/model.ts", source: "const generated = 1\n", want: "const generated = 1;\n"},
    }
    root := seedFormatApplicabilityProject(t, files)
    baseConfig := map[string]any{
      "files":   []string{"src/**"},
      "ignores": []string{"src/generated/**"},
      "format":  map[string]any{"semi": true},
    }
    encodedBase, err := json.Marshal(baseConfig)
    if err != nil {
      t.Fatalf("marshal base config: %v", err)
    }
    writeFile(t, filepath.Join(root, "lint.base.json"), string(encodedBase))
    seedLintConfig(t, root, map[string]any{
      "extends": "./lint.base.json",
      "format":  map[string]any{"semi": true},
    })
    assertFormatApplicability(t, root, files)

    resolved := resolveFormatApplicability(t, root, files[0].name)
    if resolved.Ignored || resolved.OutOfScope || len(resolved.RuleOptions("format/semi")) == 0 {
      t.Fatalf("global child contribution was lost in normal resolution: %+v", resolved)
    }
  })

  t.Run("overlapping_extends_entries_keep_each_others_match", func(t *testing.T) {
    files := []formatApplicabilityFile{
      {name: "src/base-wins.ts", source: "const baseWins = 1\n", want: "const baseWins = 1;\n"},
      {name: "src/child-wins.ts", source: "const childWins = 2\n", want: "const childWins = 2;\n"},
      {name: "src/outside.ts", source: "const outside = 3\n", want: "const outside = 3\n"},
    }
    root := seedFormatApplicabilityProject(t, files)
    baseConfig := map[string]any{
      "files": []string{
        filepath.Join("src", "base-wins.ts"),
        "src/child-wins.ts",
      },
      "ignores": []string{filepath.Join("src", "child-wins.ts")},
      "format":  map[string]any{"semi": true},
    }
    encodedBase, err := json.Marshal(baseConfig)
    if err != nil {
      t.Fatalf("marshal base config: %v", err)
    }
    writeFile(t, filepath.Join(root, "lint.base.json"), string(encodedBase))
    seedLintConfig(t, root, map[string]any{
      "extends": "./lint.base.json",
      "files": []string{
        "src/base-wins.ts",
        filepath.Join("src", "child-wins.ts"),
      },
      "ignores": []string{"src/base-wins.ts"},
      "format":  map[string]any{"semi": true},
    })
    assertFormatApplicability(t, root, files)

    for _, file := range files[:2] {
      resolved := resolveFormatApplicability(t, root, file.name)
      if resolved.Ignored || resolved.OutOfScope || len(resolved.RuleOptions("format/semi")) == 0 {
        t.Fatalf("matching entry contribution was lost for %s: %+v", file.name, resolved)
      }
    }
    outside := resolveFormatApplicability(t, root, files[2].name)
    if outside.Ignored || !outside.OutOfScope || len(outside.Rules) != 0 || len(outside.Options) != 0 {
      t.Fatalf("normal resolution retained state outside every entry: %+v", outside)
    }
    assertLSPFormatApplicability(t, root, files)
  })

  for _, scenario := range []struct {
    name        string
    writeConfig bool
  }{
    {name: "no_config"},
    {name: "empty_config", writeConfig: true},
  } {
    t.Run(scenario.name+"_keeps_format_defaults", func(t *testing.T) {
      files := []formatApplicabilityFile{
        {name: "src/main.ts", source: "const value = 1\n", want: "const value = 1;\n"},
      }
      root := seedFormatApplicabilityProject(t, files)
      if scenario.writeConfig {
        seedLintConfig(t, root, map[string]any{})
      }
      assertFormatApplicability(t, root, files)
    })
  }
}

func seedFormatApplicabilityProject(t *testing.T, files []formatApplicabilityFile) string {
  t.Helper()
  root := t.TempDir()
  names := make([]string, 0, len(files))
  for _, file := range files {
    names = append(names, filepath.ToSlash(file.name))
    writeFile(t, filepath.Join(root, filepath.FromSlash(file.name)), file.source)
  }
  config, err := json.Marshal(map[string]any{
    "compilerOptions": map[string]any{
      "module": "commonjs",
      "strict": true,
      "target": "ES2022",
    },
    "files": names,
  })
  if err != nil {
    t.Fatalf("marshal tsconfig: %v", err)
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), string(config))
  return root
}

func assertFormatApplicability(t *testing.T, root string, files []formatApplicabilityFile) {
  t.Helper()
  for pass := 1; pass <= 2; pass++ {
    code, stdout, stderr := captureCommandOutput(t, func() int {
      return run([]string{
        "format",
        "--cwd", root,
        "--plugins-json", lintManifest(t),
      })
    })
    if code != 0 || stdout != "" || stderr != "" {
      t.Fatalf("format pass %d mismatch: code=%d stdout=%q stderr=%q", pass, code, stdout, stderr)
    }
    for _, file := range files {
      assertFileText(t, filepath.Join(root, filepath.FromSlash(file.name)), file.want)
    }
  }
}

func resolveFormatApplicability(t *testing.T, root string, fileName string) ResolvedRuleConfig {
  t.Helper()
  resolver, err := loadRules(lintManifest(t), root, "")
  if err != nil {
    t.Fatalf("loadRules: %v", err)
  }
  return resolver.ResolveRules(filepath.Join(root, filepath.FromSlash(fileName)))
}

func assertLSPFormatApplicability(t *testing.T, root string, files []formatApplicabilityFile) {
  t.Helper()
  for _, file := range files {
    target := filepath.Join(root, filepath.FromSlash(file.name))
    got := executeLSPFormatBufferAppliedTextForTest(
      t,
      root,
      lintTestFileURI(t, target),
      file.source,
      file.source,
    )
    if got != file.want {
      t.Fatalf("LSP format mismatch for %s:\nwant %q\ngot  %q", file.name, file.want, got)
    }
    assertFileText(t, target, file.want)
  }
}
