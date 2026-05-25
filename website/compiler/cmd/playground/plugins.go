// First-party plugin wrappers for the website's playground wasm.
//
// Each wrapper implements host.Plugin by delegating to the same function the
// native sidecar's `main.go` calls. The native CLI binaries (`@ttsc/banner`,
// `@ttsc/paths`, `@ttsc/strip`) are thin shells over `packages/ttsc/utility`;
// inside the wasm we skip the subprocess boundary and call utility.* directly.
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/samchon/ttsc/packages/lint/linthost"
	"github.com/samchon/ttsc/packages/ttsc/utility"
)

// stderrOf returns the host stderr stream. utility.Run* writes to os.Stderr
// directly, so we use the same writer to keep plugin diagnostics on one
// stream the host can capture.
func stderrOf(_ []string) io.Writer { return os.Stderr }

type bannerPlugin struct{}

func newBannerPlugin() bannerPlugin { return bannerPlugin{} }

func (bannerPlugin) Name() string { return "@ttsc/banner" }

func (bannerPlugin) Run(command string, args []string) int {
	return runUtilityPlugin("@ttsc/banner", command, args)
}

type pathsPlugin struct{}

func newPathsPlugin() pathsPlugin { return pathsPlugin{} }

func (pathsPlugin) Name() string { return "@ttsc/paths" }

func (pathsPlugin) Run(command string, args []string) int {
	return runUtilityPlugin("@ttsc/paths", command, args)
}

type stripPlugin struct{}

func newStripPlugin() stripPlugin { return stripPlugin{} }

func (stripPlugin) Name() string { return "@ttsc/strip" }

func (stripPlugin) Run(command string, args []string) int {
	return runUtilityPlugin("@ttsc/strip", command, args)
}

// lintPlugin runs the real `@ttsc/lint` engine inside the playground wasm by
// forwarding subcommands to `linthost.Main`. The host built `args` from the
// JS options object (e.g. `--cwd=/work --tsconfig=tsconfig.json`); we
// reassemble them into the same shape `@ttsc/lint <command> ...` consumes
// when run as a CLI binary.
//
// The native CLI gets its rule config through `--plugins-json` (ttsc builds
// the payload from the project's tsconfig plugin list). The browser
// playground has no tsconfig plugin list to consult, so we synthesize a
// payload whose inline `extends` points at the published recommended
// preset — same defaults a fresh project would inherit from
// `@ttsc/lint/lib/recommended`.
type lintPlugin struct{}

func newLintPlugin() lintPlugin { return lintPlugin{} }

func (lintPlugin) Name() string { return "@ttsc/lint" }

func (lintPlugin) Run(command string, args []string) int {
	if command == "" {
		command = "check"
	}
	args = ensureLintPluginsJSON(args)
	dispatch := append([]string{command}, args...)
	return linthost.Main(dispatch)
}

// ensureLintPluginsJSON injects a synthetic `--plugins-json` payload when the
// caller didn't supply one. The default enables the full recommended preset
// so users who paste a snippet into the playground see the same diagnostics
// they would in a project that extends `@ttsc/lint/lib/recommended`.
func ensureLintPluginsJSON(args []string) []string {
	for _, a := range args {
		if hasFlagPrefix(a, "--plugins-json=") || a == "--plugins-json" {
			return args
		}
	}
	payload, err := json.Marshal([]map[string]any{
		{
			"name":  "@ttsc/lint",
			"stage": "check",
			"config": map[string]any{
				"rules":  playgroundLintRules,
				"format": map[string]any{"severity": "off"},
			},
		},
	})
	if err != nil {
		fmt.Fprintf(stderrOf(args), "@ttsc/lint: synthesize plugins-json: %v\n", err)
		return args
	}
	return append(args, "--plugins-json="+string(payload))
}

// playgroundLintRules is the default rule severity map the playground turns
// on. Tracks the most-loved rules in the recommended preset so the first
// `console.log` smoke test surfaces real diagnostics instead of falling
// silent when the user pastes a snippet.
var playgroundLintRules = map[string]any{
	"no-var":                   "error",
	"prefer-const":             "error",
	"eqeqeq":                  "error",
	"no-debugger":              "error",
	"no-empty":                 "error",
	"no-constant-condition":     "error",
	"no-duplicate-case":         "error",
	"no-dupe-keys":              "error",
	"no-self-compare":           "error",
	"no-template-curly-in-string": "warn",
	"no-throw-literal":          "warn",
	"prefer-as-const":           "error",
	"no-useless-escape":         "error",
}

// runUtilityPlugin invokes `packages/ttsc/utility` with a synthetic
// --plugins-json payload carrying just the requested plugin id. The utility
// host reads that JSON to decide which transforms to run (banner = source
// preamble; paths = module specifier rewrite; strip = call/statement
// stripping); other plugin names in the payload are ignored.
func runUtilityPlugin(name, command string, args []string) int {
	payload, err := json.Marshal([]map[string]any{
		{"name": name, "config": map[string]any{}, "stage": "transform"},
	})
	if err != nil {
		fmt.Fprintf(stderrOf(args), "%s: synthesize plugins-json: %v\n", name, err)
		return 2
	}
	args = appendArg(args, "--plugins-json="+string(payload))
	switch command {
	case "build", "":
		return utility.RunBuild(args)
	case "check":
		return utility.RunCheck(args)
	case "transform":
		return utility.RunTransform(args)
	default:
		fmt.Fprintf(stderrOf(args), "%s: unknown command %q\n", name, command)
		return 2
	}
}

// appendArg returns args with `flag` appended, dropping any prior occurrence
// so re-invoking a plugin with new options replaces the synthesized payload.
func appendArg(args []string, flag string) []string {
	out := make([]string, 0, len(args)+1)
	prefix := splitFlagPrefix(flag)
	for _, a := range args {
		if hasFlagPrefix(a, prefix) {
			continue
		}
		out = append(out, a)
	}
	out = append(out, flag)
	return out
}

func splitFlagPrefix(flag string) string {
	for i := 0; i < len(flag); i++ {
		if flag[i] == '=' {
			return flag[:i+1]
		}
	}
	return flag
}

func hasFlagPrefix(arg, prefix string) bool {
	if len(arg) < len(prefix) {
		return false
	}
	return arg[:len(prefix)] == prefix
}
