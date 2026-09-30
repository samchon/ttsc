package evidence

import "github.com/samchon/ttsc/packages/lint/rule"

type documentedCycleResults struct {
  state *graphCycleState
}

func (results documentedCycleResults) ProjectResult(
  name string,
) rule.ProjectRuleResult {
  if name != graphRuleName {
    return rule.ProjectRuleResult{Status: rule.ProjectRuleAbsent}
  }
  return rule.NewProjectRuleResult(
    rule.ProjectRuleFailed,
    results.state,
    nil,
    nil,
  )
}
