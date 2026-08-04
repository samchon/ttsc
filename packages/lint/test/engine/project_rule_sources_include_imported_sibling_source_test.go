package linthost

import (
  "path/filepath"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// importedSourcePopulationRule records the basenames of the population one
// project cycle handed it, so a scenario can assert on ctx.Sources directly
// instead of through a rendered diagnostic.
type importedSourcePopulationRule struct {
  observed *[]string
}

func (importedSourcePopulationRule) Name() string {
  return "test/imported-source-population"
}

func (r importedSourcePopulationRule) Check(ctx *publicrule.ProjectContext) {
  for _, file := range ctx.Sources {
    if file == nil {
      continue
    }
    *r.observed = append(*r.observed, filepath.Base(file.FileName()))
  }
}

// TestProjectRuleSourcesIncludeImportedSiblingSource verifies a project rule
// receives the sibling workspace source the Program read.
//
// A project rule that declares a population by glob — a coverage claim rooted
// at `../api`, say — used to receive an empty population once that sibling was
// reached by import rather than by `include`. An empty population demands
// nothing, so the claim reported full coverage while checking nothing: a silent
// pass, which is what made the gap costly (samchon/ttsc#1065).
//
// 1. Register a project rule that records every ctx.Sources basename.
// 2. Evaluate one project cycle over a consumer importing a sibling source.
// 3. Assert the population holds the consumer file and the sibling file.
func TestProjectRuleSourcesIncludeImportedSiblingSource(t *testing.T) {
  consumer, _ := seedLintSiblingSourceProject(
    t,
    "import { value } from \"../../api/src/index\";\nJSON.stringify(value);\n",
    "export const value = 1;\n",
  )
  observed := make([]string, 0)
  name := "test/imported-source-population"
  previous, existed := registeredProjectRules[name]
  registeredProjectRules[name] = projectRuleAdapter{
    inner: importedSourcePopulationRule{observed: &observed},
    name:  name,
  }
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[name] = previous
    } else {
      delete(registeredProjectRules, name)
    }
  })

  prog, diags, err := loadProgram(consumer, "tsconfig.json", loadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.close()

  prog.runProjectCycle(NewEngineWithResolver(RuleConfig{name: SeverityError}))

  for _, want := range []string{"main.ts", "index.ts"} {
    found := false
    for _, got := range observed {
      if got == want {
        found = true
        break
      }
    }
    if !found {
      t.Fatalf("project sources %v are missing %q", observed, want)
    }
  }
}
