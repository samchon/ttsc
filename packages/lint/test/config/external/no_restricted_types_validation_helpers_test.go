package linthost

import "encoding/json"

func noRestrictedTypesValidationEngine(options json.RawMessage) *Engine {
  return NewEngineWithResolver(InlineRuleResolver{
    Rules: RuleConfig{noRestrictedTypesRuleName: SeverityError},
    Options: RuleOptionsMap{
      noRestrictedTypesRuleName: options,
    },
  })
}
