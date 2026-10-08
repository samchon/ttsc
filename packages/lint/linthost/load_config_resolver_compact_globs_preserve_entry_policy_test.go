package linthost

import (
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestLoadConfigResolverCompactGlobsPreserveEntryPolicy verifies compact globs
// retain the same ordered policy for rules, formatting and project sources.
//
// A local ignore removes one entry's contribution; a global ignore excludes
// the source entirely. Later severity-only declarations inherit options only
// from earlier matching entries, including formatter settings.
//
// 1. Load authored JSON extends chains with brace files and local/global ignores.
// 2. Compare exact severities/options for selected, locally ignored and unselected paths.
// 3. Check formatter promotion and the actual project-source filter, then reload changed policy.
//
// @evidence contracts/testing.md#behavioral-verification Public LoadConfigResolver and ResolveRules fold authored JSON chains, preserve exact option payloads under severity-only overrides, and retain global/local ignore distinctions through formatCommandResolver and Engine.projectSources. Reloading modified config restores a previously globally ignored source.
// @evidence contracts/testing.md#independent-expectations Literal selector paths, declared tuple payloads and base-first precedence define each expected rule/option. Global ignores alone remove project sources; formatter off promotion preserves the matched option tuple. No expected value is derived from a graph traversal or matcher snapshot.
// @evidence contracts/testing.md#distinguishing-cases First/late brace alternatives, nested directories, local versus global ignore, nonmatching entries, out-of-scope flags, tuple inheritance, formatter applicability and config reload are contrasted. The separate native grammar and work tests own token boundaries and large selectors.
// @evidence contracts/testing.md#execution-ownership This discoverable Go unit loads isolated JSON files and calls resolver, formatter-wrapper and project-source operations in the shared process. Parsed source objects use the existing in-process test parser; no compiler producer, consumer installation, script evaluator or product child runs.
func TestLoadConfigResolverCompactGlobsPreserveEntryPolicy(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), "{}")
  base := filepath.Join(root, "base.config.json")
  writeFile(t, base, `{"ignores":["{vendor,generated}/**"],"rules":{"no-var":"error","no-restricted-syntax":["error","VariableDeclaration"]},"format":{"severity":"off","semi":true}}`)
  child := filepath.Join(root, "child.config.json")
  writeFile(t, child, `{"extends":"./base.config.json","files":["{src,test}/**/{main,unit}.ts"],"ignores":["src/{local,other}/**"],"rules":{"no-restricted-syntax":["warning","DebuggerStatement"]},"format":{"severity":"off","semi":false}}`)
  final := filepath.Join(root, "lint.config.json")
  writeFile(t, final, `{"extends":"./child.config.json","files":["{src,test}/**/{main,unit}.ts"],"rules":{"no-restricted-syntax":"error"}}`)
  load := func(location string) RuleResolver {
    resolver, err := LoadConfigResolver(&PluginEntry{Config: map[string]any{"configFile": location}}, root, filepath.Join(root, "tsconfig.json"))
    if err != nil { t.Fatalf("load %s: %v", location, err) }
    return resolver
  }
  childResolver, resolver := load(child), load(final)
  rows := []struct { name, syntax, semi string; childSeverity Severity }{
    {"src/main.ts", `"DebuggerStatement"`, `{"prefer":"never"}`, SeverityWarn},
    {"test/deep/unit.ts", `"DebuggerStatement"`, `{"prefer":"never"}`, SeverityWarn},
    {"src/local/main.ts", `"VariableDeclaration"`, `{"prefer":"always"}`, SeverityError},
    {"src/other.ts", `"VariableDeclaration"`, `{"prefer":"always"}`, SeverityError},
  }
  for _, row := range rows {
    name := filepath.Join(root, filepath.FromSlash(row.name))
    before := childResolver.ResolveRules(name)
    resolved := resolver.ResolveRules(name)
    if before.Rules.Severity("no-restricted-syntax") != row.childSeverity || resolved.Ignored || resolved.OutOfScope || resolved.Rules.Severity("no-restricted-syntax") != SeverityError || resolved.Rules.Severity("no-var") != SeverityError || string(resolved.RuleOptions("no-restricted-syntax")) != row.syntax {
      t.Errorf("%s precedence/options: child=%+v final=%+v syntax=%s", row.name, before, resolved, resolved.RuleOptions("no-restricted-syntax"))
    }
    formatted := (formatCommandResolver{inner: resolver}).ResolveRules(name)
    if formatted.Rules.Severity("format/semi") != SeverityWarn || string(formatted.RuleOptions("format/semi")) != row.semi {
      t.Errorf("%s formatter tuple: %+v options=%s", row.name, formatted, formatted.RuleOptions("format/semi"))
    }
  }
  for _, name := range []string{"vendor/main.ts", "generated/nested/unit.ts"} {
    path := filepath.Join(root, filepath.FromSlash(name))
    resolved := resolver.ResolveRules(path)
    formatted := (formatCommandResolver{inner: resolver}).ResolveRules(path)
    if !resolved.Ignored || !formatted.Ignored || len(resolved.Rules) != 0 || len(formatted.Rules) != 0 || len(resolved.Options) != 0 {
      t.Errorf("%s global ignore did not survive consumers: %+v format=%+v", name, resolved, formatted)
    }
  }
  main := parseTSFile(t, filepath.Join(root, "src", "main.ts"), "export {};\n")
  local := parseTSFile(t, filepath.Join(root, "src", "local", "main.ts"), "export {};\n")
  ignored := parseTSFile(t, filepath.Join(root, "generated", "unit.ts"), "export {};\n")
  engine := NewEngineWithResolver(resolver)
  sources := engine.projectSources([]*shimast.SourceFile{main, nil, local, ignored})
  if len(sources) != 2 || sources[0] != main || sources[1] != local {
    t.Errorf("global ignores alone must filter project sources: %+v", sources)
  }
  scoped := filepath.Join(root, "scoped.config.json")
  writeFile(t, scoped, `{"files":["{src,test}/**/{main,unit}.ts"],"ignores":["src/{local,other}/**"],"format":{"severity":"off","semi":false}}`)
  scopedResolver := load(scoped)
  selected := (formatCommandResolver{inner: scopedResolver}).ResolveRules(main.FileName())
  if selected.OutOfScope || selected.Ignored || selected.Rules.Severity("format/semi") != SeverityWarn || string(selected.RuleOptions("format/semi")) != `{"prefer":"never"}` {
    t.Errorf("scoped formatter positive did not execute its selected policy: %+v options=%s", selected, selected.RuleOptions("format/semi"))
  }
  for _, name := range []string{"src/local/main.ts", "src/other.ts"} {
    resolved := (formatCommandResolver{inner: scopedResolver}).ResolveRules(filepath.Join(root, filepath.FromSlash(name)))
    if !resolved.OutOfScope || resolved.Ignored || len(resolved.Rules) != 0 {
      t.Errorf("scoped formatter admitted rejected path %s: %+v", name, resolved)
    }
  }
  writeFile(t, base, `{"rules":{"no-var":"error"}}`)
  reloaded := load(final)
  if got := reloaded.ResolveRules(ignored.FileName()); got.Ignored || got.Rules.Severity("no-var") != SeverityError {
    t.Errorf("changed global ignore did not refresh: %+v", got)
  }
}
