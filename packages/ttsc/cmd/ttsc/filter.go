// Argument filtering for cmd/ttsc subcommand parsers.
//
// `flag.NewFlagSet(..., flag.ContinueOnError).Parse` returns an error on the
// first unknown flag it sees, which the command reports as status two. A tsgo
// option forwarded from the JS launcher would therefore reject the build before
// tsgo's own option table could consume it. This mirrors the strategy
// `packages/ttsc/utility/host.go` uses for the utility host: strip flags that
// the local FlagSet does not declare, swallowing the next token when the
// unknown flag clearly takes one. The allow-list is the same generated
// `HostFlagAllowList` shared by both consumers
// (`packages/ttsc/cmd/ttsc/flags_gen.go` and
// `packages/ttsc/utility/flags_gen.go`).

package main

import (
  "flag"
  "strings"
)

// filterHostArgs strips flags that the cmd/ttsc FlagSet does not declare,
// so a forwarded tsgo option from the JS launcher (e.g. `--strict`) does
// not make `fs.Parse` return an error, reported by the command as status two,
// before the build can hand it to tsgo via
// `--tsgo-args=<JSON>`. Flags absent from `HostFlagAllowList` are
// dropped together with their value token when they clearly take one
// (no inline `=` and the next token does not start with `-`).
//
// The allow-list itself is generated from
// `packages/ttsc/src/flags/FLAG_SCHEMA.ts` (see `flags_gen.go`); editing it
// means editing the schema and re-running `pnpm format`, not patching
// this file.
func filterHostArgs(args []string) []string {
  return filterDeclaredHostArgs(args, nil)
}

// filterDeclaredHostArgs supplements the public allow-list with the command's
// actual local declarations. Private protocol flags need no public schema entry;
// a nil local set preserves the established public filtering behavior.
func filterDeclaredHostArgs(args []string, local *flag.FlagSet) []string {
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
    if !ok && local != nil {
      if declared := local.Lookup(name); declared != nil {
        boolean, isBoolean := declared.Value.(interface{ IsBoolFlag() bool })
        takesValue = !isBoolean || !boolean.IsBoolFlag()
        ok = true
      }
    }
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

// splitFlagName strips the leading `--` from a flag argument, lower-cases the
// result, and reports whether the argument carries an inline value
// (`--foo=value`).
//
// Lower-casing is the same normalization `normalizeFlagToken` in
// `packages/ttsc/src/flags/normalizeFlagToken.ts` applies, and the generated
// `HostFlagAllowList` keys are produced by it. TypeScript's option parser
// matches option names case-insensitively, so keying this lookup on the exact
// spelling would make the Go layer stop recognising a flag the launcher and the
// compiler both resolve.
func splitFlagName(arg string) (string, bool) {
  name := strings.TrimPrefix(arg, "--")
  if i := strings.IndexByte(name, '='); i != -1 {
    return strings.ToLower(name[:i]), true
  }
  return strings.ToLower(name), false
}
