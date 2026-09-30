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
// A project rule that selects its population by glob used to receive an empty
// one whenever the files it named were reached by import rather than by the
// tsconfig selection. An empty population demands nothing, so such a rule
// passed while checking nothing: a silent pass, which is what made the gap
// costly (samchon/ttsc#1065).
//
// 1. Register a project rule that records every ctx.Sources basename.
// 2. Evaluate one project cycle over a consumer importing a sibling source.
// 3. Assert the population holds the consumer file and the sibling file.
//
// @evidence contracts/testing.md#behavioral-verification A real loaded Program hands both the consumer main.ts and imported sibling index.ts to the registered project rule through ctx.Sources.
// @evidence contracts/testing.md#independent-expectations The authored consumer import references the sibling source outside its files list, independently requiring both user basenames in the callback population. The original presence oracle does not assert population cardinality or order.
// @evidence contracts/testing.md#distinguishing-cases One directly selected consumer and one import-reached sibling distinguish config-only population from all user sources; the test retains actual load diagnostics and closes the Program.
// @evidence contracts/testing.md#execution-ownership A fixture filesystem feeds owning loadProgram and program.runProjectCycle in one Go process with a direct project-rule adapter. No consumer installation, native artifact build or compiler child is used.
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
