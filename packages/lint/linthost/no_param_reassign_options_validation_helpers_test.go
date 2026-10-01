package linthost

import "encoding/json"

func noParamReassignValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{"no-param-reassign": SeverityError},
    Options: RuleOptionsMap{
      "no-param-reassign": options,
    },
  })
}
