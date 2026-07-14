package linthost

import (
  "fmt"
  "os"
  "sort"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// projectRuleAdapter caches contributor metadata and keeps project checks on a
// separate lifecycle from node rules.
type projectRuleAdapter struct {
  inner publicrule.ProjectRule
  name  string
}

var registeredProjectRules = map[string]projectRuleAdapter{}

func registerProjectContributors() {
  projects := publicrule.RegisteredProjects()
  adapters := make([]projectRuleAdapter, 0, len(projects))
  for _, project := range projects {
    adapter, err := inspectProjectContributor(project)
    if err != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: %v; dropping project contributor entry\n", err)
      continue
    }
    adapters = append(adapters, adapter)
  }
  sort.SliceStable(adapters, func(i, j int) bool { return adapters[i].name < adapters[j].name })
  for _, adapter := range adapters {
    if adapter.name == "" {
      fmt.Fprintln(os.Stderr, "@ttsc/lint: contributor project rule with empty name ignored")
      continue
    }
    if LookupRule(adapter.name) != nil {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: contributor project rule %q collides with a file rule; dropping project contributor entry\n", adapter.name)
      continue
    }
    if _, exists := registeredProjectRules[adapter.name]; exists {
      fmt.Fprintf(os.Stderr, "@ttsc/lint: contributor project rule %q collides with an existing project rule; dropping contributor entry\n", adapter.name)
      continue
    }
    registeredProjectRules[adapter.name] = adapter
    invalidateRuntimeRuleCodes()
  }
}

func inspectProjectContributor(project publicrule.ProjectRule) (adapter projectRuleAdapter, err error) {
  defer func() {
    if recovered := recover(); recovered != nil {
      err = fmt.Errorf("contributor project rule %T metadata panicked: %v", project, recovered)
    }
  }()
  if project == nil {
    return projectRuleAdapter{}, fmt.Errorf("nil contributor project rule")
  }
  return projectRuleAdapter{inner: project, name: project.Name()}, nil
}

func allProjectRuleNames() []string {
  names := make([]string, 0, len(registeredProjectRules))
  for name := range registeredProjectRules {
    names = append(names, name)
  }
  sort.Strings(names)
  return names
}
