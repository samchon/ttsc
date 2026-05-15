package main

import (
  "fmt"
  "os"
)

// maxFormatPasses bounds the format cascade for the same reason
// `maxFixPasses` does in fix.go: a rule that re-reports its own edit
// could otherwise loop forever. Format rules touch surface details
// (quotes, semicolons, trailing commas, import order) so a real-world
// cascade settles in a handful of passes; the cap is the safety net,
// not the expected steady state.
const maxFormatPasses = 10

// RunFormat implements `@ttsc/lint format` — apply format-rule edits
// only. Write-only by contract: no diagnostic output, no typecheck
// recheck. Mirrors RunFix in flag handling so the host launcher can
// forward the same option shape.
func RunFormat(args []string) int {
  opts, err := parseSubcommandFlags("format", args)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if opts.emit {
    fmt.Fprintln(os.Stderr, "@ttsc/lint format: --emit is not supported")
    return 2
  }
  opts.noEmit = true
  return runFormat(opts)
}

func runFormat(opts *subcommandOpts) int {
  rules, err := loadRules(opts.pluginsJSON, opts.cwd, opts.tsconfig)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }

  prog, code := loadFixProgram(opts)
  if code != 0 {
    return code
  }
  defer func() {
    if prog != nil {
      prog.close()
    }
  }()

  totalFixes := 0
  cascadeConverged := false
  for pass := 0; pass < maxFormatPasses; pass++ {
    engine := NewEngineWithResolver(rules)
    findings := engine.Run(prog.userSourceFiles(), prog.checker)
    fixed, err := applyFindingFixes(opts.cwd, filterFormatFindings(findings))
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 3
    }
    if fixed == 0 {
      cascadeConverged = true
      break
    }
    totalFixes += fixed
    prog, code = reloadFixProgram(prog, opts)
    if code != 0 {
      return code
    }
  }
  if !cascadeConverged {
    // Format runs are write-only by contract, so a non-converged exit
    // leaves the user's files in a partially-formatted state with no
    // diagnostic surface to expose the cause. Emit an explicit signal
    // so they know to run again or investigate the offending rule.
    fmt.Fprintf(os.Stderr,
      "@ttsc/lint: format cascade did not converge after %d passes; rerun or check for a non-idempotent format rule\n",
      maxFormatPasses)
  }

  if opts.verbose && totalFixes > 0 {
    fmt.Fprintf(os.Stdout, "@ttsc/lint: formatted=%d edits\n", totalFixes)
  }
  return 0
}

// filterFormatFindings keeps only findings produced by FormatRule
// implementations. `RunFormat` calls this so the format-only
// subcommand never applies lint-class edits. `RunFix`, by contrast,
// applies every finding regardless of category — fix is the
// run-everything entry point.
func filterFormatFindings(findings []*Finding) []*Finding {
  out := make([]*Finding, 0, len(findings))
  for _, finding := range findings {
    if finding != nil && finding.IsFormat {
      out = append(out, finding)
    }
  }
  return out
}
