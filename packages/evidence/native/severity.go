package evidence

import (
  "encoding/json"
  "sort"

  "github.com/samchon/ttsc/packages/lint/rule"
)

func decodeGraphSeverity(raw json.RawMessage, path string) (*rule.Severity, []string) {
  if len(raw) == 0 {
    return nil, nil
  }
  var severity rule.Severity
  var value any
  if err := json.Unmarshal(raw, &value); err != nil {
    return nil, []string{"Invalid evidence/graph configuration at " + path + ": expected a lint severity value."}
  }
  switch value {
  case "off", float64(0):
    severity = rule.SeverityOff
  case "warning", "warn", float64(1):
    severity = rule.SeverityWarn
  case "error", float64(2):
    severity = rule.SeverityError
  default:
    return nil, []string{"Invalid evidence/graph configuration at " + path + ": expected 'off', 'warning', 'warn', 'error', 0, 1, or 2; omit severity or use undefined to inherit the enclosing level."}
  }
  return &severity, nil
}

// Resolve inheritance once, before populations are loaded. A nil severity is
// unset; an explicit zero disables its population.
func resolveGraphSeverities(config *graphConfig, severity rule.Severity) {
  for i := range config.Claims {
    claim := &config.Claims[i]
    claim.Level = severity
    if claim.Severity != nil {
      claim.Level = *claim.Severity
    }
    for j := range claim.References {
      reference := &claim.References[j]
      reference.Level = claim.Level
      if reference.Severity != nil {
        reference.Level = *reference.Severity
      }
    }
  }
}

type graphDiagnostic struct {
  Message  string
  Severity rule.Severity
}

type graphDiagnostics []graphDiagnostic

func (problems graphDiagnostics) add(severity rule.Severity, messages ...string) graphDiagnostics {
  for _, message := range messages {
    problems = append(problems, graphDiagnostic{Message: message, Severity: severity})
  }
  return problems
}

func (problems graphDiagnostics) report(ctx *rule.ProjectContext) {
  levels := map[string]rule.Severity{}
  for _, problem := range problems {
    levels[problem.Message] = max(levels[problem.Message], problem.Severity)
  }
  messages := make([]string, 0, len(levels))
  for message := range levels {
    messages = append(messages, message)
  }
  sort.Strings(messages)
  for _, message := range messages {
    ctx.ReportSeverity(levels[message], message)
  }
}

// A shared source problem belongs to every population that reads it. Keep the
// strongest owning level without pooling independent coverage obligations.
func populationSeverity(config graphConfig, kind artifactKind, base populationBase, path string, symbol string, descendants bool) rule.Severity {
  var severity rule.Severity
  matches := func(candidate populationBase, files globSet, symbols symbolSet) bool {
    return candidate.Absolute == base.Absolute &&
      (path == "" || files.matches(path) || descendants && files.couldMatchDescendant(path)) &&
      (symbol == "*" || symbols.contains(symbol))
  }
  for _, claim := range config.Claims {
    if claim.Type == kind && matches(claim.Base, claim.Files, claim.Symbols) {
      severity = max(severity, claim.Level)
    }
    for _, reference := range claim.References {
      if reference.Type == kind && reference.Package == "" && matches(reference.Base, reference.Files, reference.Symbols) {
        severity = max(severity, reference.Level)
      }
    }
  }
  return severity
}

func artifactSeverity(config graphConfig, kind artifactKind) rule.Severity {
  var severity rule.Severity
  for _, claim := range config.Claims {
    if claim.Type == kind {
      severity = max(severity, claim.Level)
    }
    for _, reference := range claim.References {
      if reference.Type == kind {
        severity = max(severity, reference.Level)
      }
    }
  }
  return severity
}

func swaggerSeverity(config graphConfig, source string) rule.Severity {
  var severity rule.Severity
  for _, claim := range config.Claims {
    for _, reference := range claim.References {
      if reference.Type == artifactSwagger && reference.Source == source {
        severity = max(severity, reference.Level)
      }
    }
  }
  return severity
}

func ownerSeverity(owners []claimState) rule.Severity {
  var severity rule.Severity
  for _, owner := range owners {
    severity = max(severity, owner.Spec.Level)
  }
  return severity
}

func inventorySeverity(config graphConfig, kind artifactKind, address string, symbol string) rule.Severity {
  var severity rule.Severity
  for _, base := range configuredBases(config, kind) {
    if relative, ok := base.relativeOf(address); ok {
      severity = max(severity, populationSeverity(config, kind, base, relative, symbol, false))
    }
  }
  return severity
}

// Empty or failed populations contribute no file to the shared Prisma parse.
func prismaSetSeverity(config graphConfig, inventories map[string]*artifactInventory) rule.Severity {
  var severity rule.Severity
  for address, inventory := range inventories {
    if inventory != nil && inventory.FailureBase == "" {
      severity = max(severity, inventorySeverity(config, artifactPrisma, address, "*"))
    }
  }
  return severity
}
