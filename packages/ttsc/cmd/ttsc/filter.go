// Argument filtering for cmd/ttsc subcommand parsers.
//
// `flag.NewFlagSet(..., flag.ContinueOnError).Parse` exits with non-zero on
// the first unknown flag it sees, which is exactly the failure mode RCA
// #4 in `.discussions/cli-parser-rca/report.md` flagged: a forwarded tsgo
// option from the JS launcher would crash the build before tsgo's own
// option table got a chance to consume it. Mirror the strategy that
// `packages/ttsc/utility/host.go` already uses for the utility host —
// strip flags that the local FlagSet does not declare, swallowing the
// next token when the unknown flag clearly takes one. The allow-list is
// the same generated `HostFlagAllowList` shared by both consumers
// (`packages/ttsc/cmd/ttsc/flags_gen.go` and
// `packages/ttsc/utility/flags_gen.go`).

package main

import "strings"

// filterHostArgs strips flags that the cmd/ttsc FlagSet does not declare,
// so a forwarded tsgo option from the JS launcher (e.g. `--strict`) does
// not make `fs.Parse` exit 2 before the build can hand it to tsgo via
// `--tsgo-args=&lt;JSON&gt;`. Flags absent from `HostFlagAllowList` are
// dropped together with their value token when they clearly take one
// (no inline `=` and the next token does not start with `-`).
//
// The allow-list itself is generated from
// `packages/ttsc/src/flags/schema.ts` (see `flags_gen.go`); editing it
// means editing the schema and re-running `pnpm format`, not patching
// this file.
func filterHostArgs(args []string) []string {
  filtered := make([]string, 0, len(args))
  for i := 0; i < len(args); i++ {
    current := args[i]
    if current == "--" {
      // Forward `--` and everything after verbatim. The Go flag parser
      // treats `--` as "end of options" and stops there; mirroring that
      // behavior here keeps trailing positional tokens intact.
      filtered = append(filtered, args[i:]...)
      break
    }
    if !strings.HasPrefix(current, "--") {
      filtered = append(filtered, current)
      continue
    }
    name, hasInlineValue := splitFlagName(current)
    takesValue, ok := HostFlagAllowList[name]
    if ok {
      filtered = append(filtered, current)
      if takesValue && !hasInlineValue && i+1 < len(args) {
        i++
        filtered = append(filtered, args[i])
      }
      continue
    }
    if !hasInlineValue && i+1 < len(args) && !strings.HasPrefix(args[i+1], "-") {
      i++
    }
  }
  return filtered
}

// splitFlagName strips the leading `--` from a flag argument and reports
// whether the argument carries an inline value (`--foo=value`).
func splitFlagName(arg string) (string, bool) {
  name := strings.TrimPrefix(arg, "--")
  if i := strings.IndexByte(name, '='); i != -1 {
    return name[:i], true
  }
  return name, false
}
