package main

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// The descriptor names the fixture protocol; both operations share one executable.
func main() {
	run := genericRun
	for _, argument := range os.Args[1:] {
		if !strings.HasPrefix(argument, "--plugins-json=") {
			continue
		}
		var plugins []struct {
			Config map[string]any `json:"config"`
		}
		if json.Unmarshal([]byte(strings.TrimPrefix(argument, "--plugins-json=")), &plugins) != nil {
			break
		}
		if len(plugins) != 0 && plugins[0].Config["fixtureProtocol"] == "cache" {
			run = cacheRun
		}
		break
	}
	os.Exit(run(os.Args[1:]))
}

var genericGoUpperCall = regexp.MustCompile(`(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*goUpper\("([^"]*)"\)\s*;`)

type genericPluginDescriptor struct {
	Config map[string]any `json:"config"`
	Name   string         `json:"name"`
	Stage  string         `json:"stage"`
}

type genericGraphSection struct {
	Edges                     map[string][]string `json:"edges"`
	Globals                   []string            `json:"globals"`
	Configs                   []string            `json:"configs"`
	InputHashes               map[string]*string  `json:"inputHashes,omitempty"`
	InputRealpaths            map[string]*string  `json:"inputRealpaths,omitempty"`
	UseCaseSensitiveFileNames *bool               `json:"useCaseSensitiveFileNames,omitempty"`
}

type genericTransformResult struct {
	TypeScript           map[string]string    `json:"typescript"`
	Dependencies         map[string][]string  `json:"dependencies,omitempty"`
	DependenciesComplete []string             `json:"dependenciesComplete,omitempty"`
	Graph                *genericGraphSection `json:"graph,omitempty"`
	HostInputs           []string             `json:"hostInputs,omitempty"`
	HostInputHashes      map[string]*string   `json:"hostInputHashes,omitempty"`
	HostInputRealpaths   map[string]*string   `json:"hostInputRealpaths,omitempty"`
	Volatile             []string             `json:"volatile,omitempty"`
}

// collectedDependencies is filled by the emit-dependencies operation and
// rides the transform envelope's optional dependencies field.
var genericCollectedDependencies map[string][]string

// collectedGraph is filled by the emit-graph operation and rides the
// transform envelope's optional graph section, mirroring the reference
// graph a driver-SDK host stamps.
var genericCollectedGraph *genericGraphSection

// collectedVolatile is filled by the emit-volatile operation and rides
// the transform envelope's optional volatile list.
var genericCollectedVolatile []string
var genericCollectedHostInputs []string
var genericCollectedHostInputHashes map[string]*string
var genericCollectedHostInputRealpaths map[string]*string

// collectedComplete is filled by the declare-complete operation and rides
// the transform envelope's optional dependenciesComplete list, mirroring a
// producer that declares its reported dependency list exhaustive.
var genericCollectedComplete []string

// extraOutputs echoes further project files into the envelope's typescript
// map, so a scenario can address more than one transformed file in the one
// envelope a transform invocation produces.
var genericExtraOutputs = map[string]string{}

func genericRun(args []string) int {
	if len(args) == 0 {
		return 2
	}
	switch args[0] {
	case "transform":
		return genericTransform(args[1:])
	case "check", "build":
		return genericVerifyEnvOperations(args[1:])
	case "version":
		return 0
	default:
		fmt.Fprintf(os.Stderr, "fixture: unknown command %q\n", args[0])
		return 2
	}
}

// verifyEnvOperations keeps the check/build subcommands as no-ops except
// when a plugin entry explicitly requests the env assertion, so the
// scrub of an inherited TTSC_PLUGIN_CONFIG_DIR is observable on the
// build lane too.
func genericVerifyEnvOperations(args []string) int {
	for _, arg := range args {
		if !strings.HasPrefix(arg, "--plugins-json=") {
			continue
		}
		plugins, err := genericParsePlugins(strings.TrimPrefix(arg, "--plugins-json="))
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		for _, plugin := range plugins {
			if genericOperation(plugin.Config) != "assert-no-plugin-config-dir" {
				continue
			}
			if v := os.Getenv("TTSC_PLUGIN_CONFIG_DIR"); v != "" {
				fmt.Fprintf(os.Stderr, "TTSC_PLUGIN_CONFIG_DIR must be scrubbed from an undeclared run, got %q\n", v)
				return 2
			}
		}
	}
	return 0
}

func genericTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	tsconfig := fs.String("tsconfig", "", "")
	pluginsJSON := fs.String("plugins-json", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	root := *cwd
	if root == "" {
		root, _ = os.Getwd()
	}
	source, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	plugins, err := genericParsePlugins(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	code, err := genericTransformSource(string(source), plugins, *tsconfig, root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	outputs := map[string]string{"src/main.ts": code}
	for key, text := range genericExtraOutputs {
		outputs[key] = text
	}
	data, err := json.Marshal(genericTransformResult{TypeScript: outputs, Dependencies: genericCollectedDependencies, DependenciesComplete: genericCollectedComplete, Graph: genericCollectedGraph, HostInputs: genericCollectedHostInputs, HostInputHashes: genericCollectedHostInputHashes, HostInputRealpaths: genericCollectedHostInputRealpaths, Volatile: genericCollectedVolatile})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	fmt.Fprintln(os.Stdout, string(data))
	return 0
}

func genericParsePlugins(input string) ([]genericPluginDescriptor, error) {
	if input == "" {
		return nil, nil
	}
	var plugins []genericPluginDescriptor
	if err := json.Unmarshal([]byte(input), &plugins); err != nil {
		return nil, err
	}
	return plugins, nil
}

func genericTransformSource(source string, plugins []genericPluginDescriptor, tsconfig string, root string) (string, error) {
	match := genericGoUpperCall.FindStringSubmatch(source)
	if match == nil {
		return "", fmt.Errorf(`expected export const value = goUpper("...")`)
	}
	name := match[1]
	value := match[2]
	if len(plugins) == 0 {
		plugins = []genericPluginDescriptor{{Config: map[string]any{"operation": "go-uppercase"}}}
	}
	for _, plugin := range plugins {
		switch genericOperation(plugin.Config) {
		case "assert-paths":
			if err := genericAssertPaths(tsconfig, plugin.Config); err != nil {
				return "", err
			}
			value = strings.ToUpper(value)
		case "assert-absolute-alias-paths":
			if err := genericAssertAbsoluteAliasPaths(tsconfig, plugin.Config); err != nil {
				return "", err
			}
			value = strings.ToUpper(value)
		case "emit-dependencies":
			genericCollectedDependencies = genericDependenciesFromConfig(plugin.Config)
			value = strings.ToUpper(value)
		case "emit-graph":
			genericCollectedGraph = genericGraphFromConfig(plugin.Config)
			if genericBoolValue(plugin.Config, "echoTsconfig") {
				// Echo the host-provided --tsconfig path into the config chain,
				// mirroring how a real driver-SDK graph lists the loaded config;
				// with an alias/compiler-options overlay that is the generated
				// temp-dir tsconfig the adapter must drop from watch inputs.
				genericCollectedGraph.Configs = append(genericCollectedGraph.Configs, tsconfig)
			}
			genericAddGraphInputProofs(genericCollectedGraph, root)
			value = strings.ToUpper(value)
		case "declare-complete":
			genericCollectedComplete = genericStringListValue(plugin.Config, "complete")
			value = strings.ToUpper(value)
		case "echo-file":
			relative := genericStringValue(plugin.Config, "path")
			text, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(relative)))
			if err != nil {
				return "", err
			}
			// Append a marker so the echoed output differs from its source and
			// the adapter reports a real transform result for it.
			genericExtraOutputs[relative] = string(text) + "// ttsc-fixture\n"
			value = strings.ToUpper(value)
		case "emit-volatile":
			genericCollectedVolatile = genericStringListValue(plugin.Config, "volatile")
			// A volatile transform depends on non-file inputs by definition;
			// embed one so replayed cache entries are observably stale.
			value = strings.ToUpper(value) + ":" + strconv.FormatInt(time.Now().UnixNano(), 10)
		case "assert-temp-tsconfig-outside-project":
			if err := genericAssertTempTsconfigOutsideProject(root, tsconfig); err != nil {
				return "", err
			}
			value = strings.ToUpper(value)
		case "assert-config-path":
			if err := genericAssertConfigPath(root, plugin.Config); err != nil {
				return "", err
			}
			value = strings.ToUpper(value)
		case "assert-config-file-path":
			if err := genericAssertConfigFilePath(root, plugin.Config); err != nil {
				return "", err
			}
			if !genericBoolValue(plugin.Config, "omitHostInputProof") {
				if err := genericRecordHostInput(genericStringValue(plugin.Config, "configFile")); err != nil {
					return "", err
				}
			}
			value = strings.ToUpper(value)
		case "assert-no-plugin-config-dir":
			if v := os.Getenv("TTSC_PLUGIN_CONFIG_DIR"); v != "" {
				return "", fmt.Errorf("TTSC_PLUGIN_CONFIG_DIR must be scrubbed from an undeclared run, got %q", v)
			}
			value = strings.ToUpper(value)
		case "read-helper":
			helper, err := os.ReadFile(filepath.Join(root, "src", "helper.ts"))
			if err != nil {
				return "", err
			}
			value = strings.ToUpper(value) + ":" + strings.ToUpper(strings.TrimSpace(string(helper)))
		case "read-configured-helper":
			helper, err := os.ReadFile(filepath.Join(root, genericStringValue(plugin.Config, "path")))
			if err != nil {
				return "", err
			}
			value = strings.ToUpper(value) + ":" + strings.ToUpper(strings.TrimSpace(string(helper)))
		case "count-runs":
			if err := genericCountRun(plugin.Config); err != nil {
				return "", err
			}
		case "await-release":
			if err := genericAwaitRelease(plugin.Config); err != nil {
				return "", err
			}
		case "go-uppercase":
			value = strings.ToUpper(value)
		case "go-prefix":
			value = genericStringValue(plugin.Config, "prefix") + value
		case "go-suffix":
			value += genericStringValue(plugin.Config, "suffix")
		default:
			return "", fmt.Errorf("unsupported operation")
		}
	}
	return fmt.Sprintf("export const %s = %q;\nconsole.log(%s);\n", name, value, name), nil
}

// countRun appends one byte per transform invocation to the configured
// run log, so a scenario can count whole-project compiles from outside the
// build. The log lives wherever the caller puts it, which is deliberately
// outside the project so the transform's own input walk never sees it.
func genericCountRun(config map[string]any) error {
	runLog := genericStringValue(config, "runLog")
	if runLog == "" {
		return fmt.Errorf("count-runs requires a runLog path")
	}
	file, err := os.OpenFile(runLog, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	if _, err := file.Write([]byte{1}); err != nil {
		_ = file.Close()
		return err
	}
	return file.Close()
}

// genericAwaitRelease holds the compile at a point the caller chooses: it writes
// the configured barrier file, then waits for the release file, so a
// scenario can change the disk while a compile is known to be running.
// The caller releases in finally and joins the original delivery. Withdrawing
// its published barrier cancels the hold; filesystem failures remain failures.
func genericAwaitRelease(config map[string]any) error {
	barrier := genericStringValue(config, "barrier")
	release := genericStringValue(config, "release")
	if barrier == "" || release == "" {
		return fmt.Errorf("await-release requires barrier and release paths")
	}
	// Publish only after closing our handle: on Windows a visible open file
	// cannot yet be withdrawn by the owner that observes it.
	publication, err := os.CreateTemp(filepath.Dir(barrier), ".barrier-")
	if err != nil {
		return err
	}
	if err := publication.Close(); err != nil {
		return errors.Join(err, os.Remove(publication.Name()))
	}
	if err := os.Rename(publication.Name(), barrier); err != nil {
		return errors.Join(err, os.Remove(publication.Name()))
	}
	for {
		if _, err := os.Stat(barrier); err != nil {
			return fmt.Errorf("await-release barrier unavailable: %w", err)
		}
		parent, err := os.Stat(filepath.Dir(release))
		if err != nil {
			return err
		}
		if !parent.IsDir() {
			return fmt.Errorf("await-release parent is not a directory: %s", release)
		}
		if info, err := os.Stat(release); err == nil {
			if !info.Mode().IsRegular() {
				return fmt.Errorf("await-release requires a regular release file: %s", release)
			}
			return nil
		} else if !os.IsNotExist(err) {
			return err
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func genericAssertPaths(tsconfig string, config map[string]any) error {
	if tsconfig == "" {
		return fmt.Errorf("missing tsconfig flag")
	}
	data, err := os.ReadFile(tsconfig)
	if err != nil {
		return err
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	compilerOptions, _ := parsed["compilerOptions"].(map[string]any)
	paths, _ := compilerOptions["paths"].(map[string]any)
	key := genericStringValue(config, "key")
	target := genericStringValue(config, "target")
	if !genericPathEntryEquals(paths[key], target) {
		return fmt.Errorf("missing paths entry %s -> %s", key, target)
	}
	if !genericPathEntryEquals(paths[key+"/*"], target+"/*") {
		return fmt.Errorf("missing paths entry %s/* -> %s/*", key, target)
	}
	return nil
}

func genericAssertAbsoluteAliasPaths(tsconfig string, config map[string]any) error {
	if tsconfig == "" {
		return fmt.Errorf("missing tsconfig flag")
	}
	data, err := os.ReadFile(tsconfig)
	if err != nil {
		return err
	}
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return err
	}
	compilerOptions, _ := parsed["compilerOptions"].(map[string]any)
	if _, found := compilerOptions["baseUrl"]; found {
		return fmt.Errorf("generated tsconfig must not declare baseUrl (removed in TypeScript-Go)")
	}
	paths, _ := compilerOptions["paths"].(map[string]any)
	key := genericStringValue(config, "key")
	entries, ok := paths[key].([]any)
	if !ok || len(entries) == 0 {
		return fmt.Errorf("missing paths entry for %s", key)
	}
	target, _ := entries[0].(string)
	if !filepath.IsAbs(filepath.FromSlash(target)) {
		return fmt.Errorf("paths target for %s is not absolute: %s", key, target)
	}
	if !genericPathEntryEquals(paths[key+"/*"], target+"/*") {
		return fmt.Errorf("missing paths entry %s/* -> %s/*", key, target)
	}
	return nil
}

func genericAssertTempTsconfigOutsideProject(root string, tsconfig string) error {
	if tsconfig == "" {
		return fmt.Errorf("missing tsconfig flag")
	}
	cleanRoot, err := filepath.Abs(root)
	if err != nil {
		return err
	}
	cleanConfig, err := filepath.Abs(tsconfig)
	if err != nil {
		return err
	}
	if cleanConfig == filepath.Join(cleanRoot, "tsconfig.json") {
		return nil
	}
	rel, err := filepath.Rel(cleanRoot, cleanConfig)
	if err != nil {
		return err
	}
	if rel == "." || rel == "" || (!strings.HasPrefix(rel, ".."+string(os.PathSeparator)) && rel != "..") {
		return fmt.Errorf("temporary tsconfig was written under project root: %s", cleanConfig)
	}
	return nil
}

func genericAssertConfigPath(root string, config map[string]any) error {
	expected := filepath.Join(root, "fixture.config.json")
	actual := genericStringValue(config, "config")
	if actual != expected {
		return fmt.Errorf("expected config path %s, got %s", expected, actual)
	}
	return nil
}

func genericAssertConfigFilePath(root string, config map[string]any) error {
	expected := filepath.Join(root, "fixture.config.json")
	actual := genericStringValue(config, "configFile")
	if actual != expected {
		return fmt.Errorf("expected configFile path %s, got %s", expected, actual)
	}
	return nil
}

// recordHostInput mirrors the compiler-time evidence a native plugin
// must publish for every config file whose bytes influenced output.
func genericRecordHostInput(file string) error {
	data, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	realpath, err := filepath.EvalSymlinks(file)
	if err != nil {
		return err
	}
	absolute, err := filepath.Abs(realpath)
	if err != nil {
		return err
	}
	digest := sha256.Sum256(data)
	hash := fmt.Sprintf("%x", digest[:])
	genericCollectedHostInputs = append(genericCollectedHostInputs, file)
	genericCollectedHostInputHashes = map[string]*string{file: &hash}
	genericCollectedHostInputRealpaths = map[string]*string{file: &absolute}
	return nil
}

// dependenciesFromConfig reads the emit-dependencies operation's
// "dependencies" list and keys it to the transformed file, mirroring how
// a real type-driven plugin reports the sources it consulted.
func genericDependenciesFromConfig(config map[string]any) map[string][]string {
	raw, _ := config["dependencies"].([]any)
	out := make([]string, 0, len(raw))
	for _, entry := range raw {
		if text, ok := entry.(string); ok {
			out = append(out, text)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return map[string][]string{"src/main.ts": out}
}

// graphFromConfig reads the emit-graph operation's edges/globals/configs
// keys, mirroring the reference graph a driver-SDK host computes from the
// loaded program.
func genericGraphFromConfig(config map[string]any) *genericGraphSection {
	section := &genericGraphSection{
		Edges:          map[string][]string{},
		Globals:        genericStringListValue(config, "globals"),
		Configs:        genericStringListValue(config, "configs"),
		InputHashes:    genericOptionalStringMapValue(config, "inputHashes"),
		InputRealpaths: genericOptionalStringMapValue(config, "inputRealpaths"),
	}
	// The case policy a real compiler reports from its own filesystem; a
	// scenario sets it to stand for a compiler on another kind of volume.
	if value, ok := config["useCaseSensitiveFileNames"].(bool); ok {
		section.UseCaseSensitiveFileNames = &value
	}
	rawEdges, _ := config["edges"].(map[string]any)
	for source, targets := range rawEdges {
		list, _ := targets.([]any)
		out := make([]string, 0, len(list))
		for _, entry := range list {
			if text, ok := entry.(string); ok {
				out = append(out, text)
			}
		}
		if len(out) != 0 {
			section.Edges[source] = out
		}
	}
	return section
}

// addGraphInputProofs gives the synthetic host the same generation-time
// evidence contract as the real driver: every graph spelling carries the
// bytes/kind and physical target observed for this transform.
func genericAddGraphInputProofs(graph *genericGraphSection, root string) {
	inputs := map[string]struct{}{}
	for source, targets := range graph.Edges {
		inputs[source] = struct{}{}
		for _, target := range targets {
			inputs[target] = struct{}{}
		}
	}
	for _, input := range graph.Globals {
		inputs[input] = struct{}{}
	}
	for _, input := range graph.Configs {
		inputs[input] = struct{}{}
	}
	for input := range inputs {
		genericAddGraphInputProof(graph, root, input)
	}
}

func genericAddGraphInputProof(graph *genericGraphSection, root, input string) {
	_, hasHash := graph.InputHashes[input]
	_, hasRealpath := graph.InputRealpaths[input]
	if hasHash && hasRealpath {
		return
	}
	file := filepath.FromSlash(input)
	if !filepath.IsAbs(file) {
		file = filepath.Join(root, file)
	}
	realpath, ok := genericPhysicalGraphInput(file)
	if !ok {
		graph.InputHashes[input] = nil
		graph.InputRealpaths[input] = nil
		return
	}
	data, err := os.ReadFile(file)
	if err != nil {
		info, statErr := os.Stat(file)
		if statErr != nil || !info.IsDir() {
			return
		}
		data = []byte("ttsc:host-input:directory\x00")
	}
	if !hasHash {
		digest := sha256.Sum256(data)
		hash := fmt.Sprintf("%x", digest[:])
		graph.InputHashes[input] = &hash
	}
	if !hasRealpath {
		graph.InputRealpaths[input] = &realpath
	}
}

// physicalGraphInput follows both ordinary symlinks and Windows
// junction ancestors, matching the production host's graph proof.
func genericPhysicalGraphInput(file string) (string, bool) {
	resolved, err := filepath.Abs(file)
	if err != nil {
		return "", false
	}
	resolved = filepath.Clean(resolved)
	seen := map[string]struct{}{}
	for range 255 {
		if _, exists := seen[resolved]; exists {
			return "", false
		}
		seen[resolved] = struct{}{}
		if evaluated, evalErr := filepath.EvalSymlinks(resolved); evalErr == nil {
			evaluated, evalErr = filepath.Abs(evaluated)
			if evalErr != nil {
				return "", false
			}
			evaluated = filepath.Clean(evaluated)
			if _, statErr := os.Stat(evaluated); statErr != nil {
				return "", false
			}
			return evaluated, true
		}
		next, ok := genericResolveGraphInputLinkAncestor(resolved)
		if !ok {
			return "", false
		}
		resolved = next
	}
	return "", false
}

func genericResolveGraphInputLinkAncestor(location string) (string, bool) {
	probe := filepath.Clean(location)
	suffix := []string{}
	for {
		if target, err := os.Readlink(probe); err == nil {
			if !filepath.IsAbs(target) {
				target = filepath.Join(filepath.Dir(probe), target)
			}
			for i := len(suffix) - 1; i >= 0; i-- {
				target = filepath.Join(target, suffix[i])
			}
			absolute, absErr := filepath.Abs(target)
			if absErr != nil {
				return "", false
			}
			return filepath.Clean(absolute), true
		}
		parent := filepath.Dir(probe)
		if parent == probe {
			return "", false
		}
		suffix = append(suffix, filepath.Base(probe))
		probe = parent
	}
}

func genericOptionalStringMapValue(config map[string]any, key string) map[string]*string {
	output := map[string]*string{}
	raw, _ := config[key].(map[string]any)
	for name, value := range raw {
		if value == nil {
			output[name] = nil
			continue
		}
		if text, ok := value.(string); ok {
			copied := text
			output[name] = &copied
		}
	}
	return output
}

func genericStringListValue(config map[string]any, key string) []string {
	raw, _ := config[key].([]any)
	out := make([]string, 0, len(raw))
	for _, entry := range raw {
		if text, ok := entry.(string); ok {
			out = append(out, text)
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// pathEntryEquals compares a paths target by identity: the adapter writes
// the wrapper's targets as the compiler spells the project, physically,
// while a test names the project through the temporary directory's link
// on macOS. The `/*` suffix of a pattern is compared as text.
func genericPathEntryEquals(value any, expected string) bool {
	entries, ok := value.([]any)
	if !ok || len(entries) == 0 {
		return false
	}
	actual, _ := entries[0].(string)
	if actual == expected {
		return true
	}
	actualPath, actualStar := strings.CutSuffix(actual, "/*")
	expectedPath, expectedStar := strings.CutSuffix(expected, "/*")
	if actualStar != expectedStar {
		return false
	}
	return genericSamePath(filepath.FromSlash(actualPath), filepath.FromSlash(expectedPath))
}

// samePath compares two spellings of one path physically, resolving the
// nearest existing ancestor of a path that does not exist.
func genericSamePath(left, right string) bool {
	physical := func(file string) string {
		resolved, err := filepath.EvalSymlinks(file)
		if err == nil {
			return resolved
		}
		parent, err := filepath.EvalSymlinks(filepath.Dir(file))
		if err != nil {
			return filepath.Clean(file)
		}
		return filepath.Join(parent, filepath.Base(file))
	}
	return physical(left) == physical(right)
}

func genericOperation(config map[string]any) string {
	if value, ok := config["operation"].(string); ok && value != "" {
		return value
	}
	if _, ok := config["prefix"]; ok {
		return "go-prefix"
	}
	if _, ok := config["suffix"]; ok {
		return "go-suffix"
	}
	return "go-uppercase"
}

func genericStringValue(config map[string]any, key string) string {
	value, _ := config[key].(string)
	return value
}

func genericBoolValue(config map[string]any, key string) bool {
	value, _ := config[key].(bool)
	return value
}

type cachePluginDescriptor struct {
	Config map[string]any `json:"config"`
}

type cacheGraphSection struct {
	Edges              map[string][]string       `json:"edges"`
	Globals            []string                  `json:"globals"`
	Configs            []string                  `json:"configs"`
	Candidates         map[string][]string       `json:"candidates,omitempty"`
	InputHashes        map[string]*string        `json:"inputHashes,omitempty"`
	InputRealpaths     map[string]*string        `json:"inputRealpaths,omitempty"`
	InputProofFailures map[string]string         `json:"inputProofFailures,omitempty"`
	InputObservations  map[string]map[string]any `json:"inputObservations,omitempty"`
}

type cacheTransformResult struct {
	TypeScript map[string]string  `json:"typescript"`
	Graph      *cacheGraphSection `json:"graph,omitempty"`
}

func cacheRun(args []string) int {
	if len(args) == 0 {
		return 2
	}
	switch args[0] {
	case "transform":
		return cacheTransform(args[1:])
	case "check", "version", "build":
		return 0
	default:
		fmt.Fprintf(os.Stderr, "cache-probe: unknown command %q\n", args[0])
		return 2
	}
}

// cacheLifetimeReceipt binds one held invocation to its authored owner session.
type cacheLifetimeReceipt struct {
	Session string `json:"session"`
	Token   string `json:"token"`
	PID     int    `json:"pid"`
}

// cachePublishLifetime refuses an existing receipt instead of reusing its identity.
func cachePublishLifetime(file string, receipt cacheLifetimeReceipt) error {
	data, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	data = append(data, '\n')
	f, err := os.OpenFile(file, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	n, writeErr := f.Write(data)
	if n != len(data) && writeErr == nil {
		writeErr = io.ErrShortWrite
	}
	return errors.Join(writeErr, f.Close())
}

// cacheLifetimeReleased accepts only the exact regular-file release receipt.
func cacheLifetimeReleased(file string, expected cacheLifetimeReceipt) (bool, error) {
	directory, err := os.Lstat(filepath.Dir(file))
	if err != nil {
		return false, err
	}
	if !directory.IsDir() {
		return false, fmt.Errorf("native lifetime gate parent is not a directory: %s", file)
	}
	info, err := os.Lstat(file)
	if os.IsNotExist(err) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if !info.Mode().IsRegular() {
		return false, fmt.Errorf("native lifetime release is not a regular file: %s", file)
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return false, err
	}
	if len(data) == 0 || data[len(data)-1] != '\n' {
		return false, nil
	}
	var actual cacheLifetimeReceipt
	decoder := json.NewDecoder(strings.NewReader(string(data)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&actual); err != nil {
		return false, err
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return false, fmt.Errorf("native lifetime release has trailing data: %s", file)
	}
	if actual != expected {
		return false, fmt.Errorf("native lifetime release identity mismatch: %s", file)
	}
	return true, nil
}

// cacheHoldNativeLifetime is opt-in fixture ownership, before the real workload.
// The caller releases the exact receipt; its enclosing process owner contains
// this native descendant if release fails or the caller dies. No timed expiry
// may silently turn an enrollment PID into a later process's identity.
func cacheHoldNativeLifetime(cfg map[string]any) error {
	directory := cacheStringValue(cfg, "nativeLifetimeDirectory")
	session := cacheStringValue(cfg, "nativeLifetimeSession")
	if directory == "" && session == "" {
		return nil
	}
	if !filepath.IsAbs(directory) || session == "" {
		return fmt.Errorf("native lifetime gate requires an absolute directory and session")
	}
	var token [16]byte
	if _, err := rand.Read(token[:]); err != nil {
		return err
	}
	receipt := cacheLifetimeReceipt{Session: session, Token: hex.EncodeToString(token[:]), PID: os.Getpid()}
	if err := cachePublishLifetime(filepath.Join(directory, receipt.Token+".json"), receipt); err != nil {
		return err
	}
	for {
		released, err := cacheLifetimeReleased(filepath.Join(directory, receipt.Token+".release"), receipt)
		if err != nil || released {
			return err
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func cacheTransform(args []string) int {
	fs := flag.NewFlagSet("transform", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	cwd := fs.String("cwd", "", "")
	fs.String("tsconfig", "", "")
	pluginsJSON := fs.String("plugins-json", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	root := *cwd
	if root == "" {
		root, _ = os.Getwd()
	}
	cfg := cacheFirstConfig(*pluginsJSON)

	if logPath := cacheStringValue(cfg, "runLog"); logPath != "" {
		f, err := os.OpenFile(logPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err == nil {
			var writeErr error
			if cacheBoolValue(cfg, "runLogPids") {
				// The same native invocation receipt exposes its real process owner.
				_, writeErr = f.WriteString(strconv.Itoa(os.Getpid()) + "\n")
			} else {
				_, writeErr = f.WriteString("x")
			}
			err = errors.Join(writeErr, f.Close())
		}
		if err != nil && cacheStringValue(cfg, "nativeLifetimeDirectory") != "" {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
	}

	if delay := cacheNumberValue(cfg, "transformDelayMs"); delay > 0 {
		if err := cacheHoldNativeLifetime(cfg); err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		time.Sleep(time.Duration(delay) * time.Millisecond)
	}

	ts := map[string]string{}
	observedInputs := map[string]string{}
	if nonInput := cacheStringValue(cfg, "nonInputRaceFile"); nonInput != "" {
		target := nonInput
		if !filepath.IsAbs(target) {
			target = filepath.Join(root, filepath.FromSlash(nonInput))
		}
		os.MkdirAll(filepath.Dir(target), 0o755)
		os.WriteFile(target, []byte(fmt.Sprintf("run-%d\n", time.Now().UnixNano())), 0o644)
	}
	srcDir := filepath.Join(root, "src")
	entries, err := os.ReadDir(srcDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	names := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".ts") {
			continue
		}
		names = append(names, e.Name())
	}
	for _, name := range names {
		file := filepath.Join(srcDir, name)
		raceFile := cacheStringValue(cfg, "snapshotRaceFile")
		raceMarker := cacheStringValue(cfg, "snapshotRaceMarker")
		raced := false
		if raceFile != "" && cacheSamePath(file, raceFile) && raceMarker != "" {
			if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {
				os.WriteFile(raceMarker, []byte("1"), 0o644)
				os.WriteFile(file, []byte(cacheStringValue(cfg, "snapshotRaceDuring")), 0o644)
				raced = true
			}
		}
		data, err := os.ReadFile(file)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return 2
		}
		input := "src/" + name
		observedInputs[input] = string(data)
		ts[input] = strings.ReplaceAll(string(data), "PROBE", "PROBED")
		if raced && raceFile != "" && cacheSamePath(file, raceFile) && cacheStringValue(cfg, "snapshotRaceOriginal") != "" {
			if err := os.WriteFile(raceFile, []byte(cacheStringValue(cfg, "snapshotRaceOriginal")), 0o644); err != nil {
				fmt.Fprintln(os.Stderr, err)
				return 2
			}
		}
	}
	for j := 0; j < int(cacheNumberValue(cfg, "externalSourceOutputs")); j++ {
		input := fmt.Sprintf("node_modules/external-source/mod%d.ts", j)
		file := filepath.Join(root, filepath.FromSlash(input))
		data, readErr := os.ReadFile(file)
		if readErr != nil {
			fmt.Fprintln(os.Stderr, readErr)
			return 2
		}
		observedInputs[input] = string(data)
		if j == 0 && cacheBoolValue(cfg, "externalSourceChangesAfterRead") {
			marker := cacheStringValue(cfg, "snapshotRaceMarker")
			if _, statErr := os.Stat(marker); os.IsNotExist(statErr) {
				os.WriteFile(marker, []byte("1"), 0o644)
				os.WriteFile(file, []byte("export const external = \"PROBE-AFTER\";\n"), 0o644)
			}
		}
		ts[input] = strings.ReplaceAll(string(data), "PROBE", "PROBED")
	}
	externalRaceFile := cacheStringValue(cfg, "externalRaceFile")
	externalRaceOriginal := cacheStringValue(cfg, "externalRaceOriginal")
	externalRaceText := ""
	if externalRaceFile != "" {
		externalRaced := false
		raceMarker := cacheStringValue(cfg, "snapshotRaceMarker")
		if raceMarker != "" {
			if _, statErr := os.Stat(raceMarker); os.IsNotExist(statErr) {
				os.WriteFile(raceMarker, []byte("1"), 0o644)
				os.WriteFile(externalRaceFile, []byte(cacheStringValue(cfg, "snapshotRaceDuring")), 0o644)
				externalRaced = true
			}
		}
		data, readErr := os.ReadFile(externalRaceFile)
		if readErr != nil {
			fmt.Fprintln(os.Stderr, readErr)
			return 2
		}
		externalRaceText = string(data)
		observedInputs[externalRaceFile] = externalRaceText
		for key, value := range ts {
			ts[key] = value + "// " + strings.TrimSpace(externalRaceText) + "\n"
		}
		if externalRaced && externalRaceOriginal != "" {
			if writeErr := os.WriteFile(externalRaceFile, []byte(externalRaceOriginal), 0o644); writeErr != nil {
				fmt.Fprintln(os.Stderr, writeErr)
				return 2
			}
		}
	}
	if cacheBoolValue(cfg, "emitExternal") {
		ts["node_modules/dep/types.d.css.ts"] = "export {};\n"
	}

	if marker := cacheStringValue(cfg, "failOnMarker"); marker != "" {
		for _, text := range observedInputs {
			if !strings.Contains(text, marker) {
				continue
			}
			os.WriteFile(cacheStringValue(cfg, "failReadStamp"), []byte("1"), 0o644)
			time.Sleep(time.Duration(cacheNumberValue(cfg, "failDelayMs")) * time.Millisecond)
			fmt.Fprintln(os.Stderr, "cache-probe: a source is marked failing")
			return 1
		}
	}

	result := cacheTransformResult{TypeScript: ts}
	if fanout := int(cacheNumberValue(cfg, "graphFanout")); fanout > 0 {
		externals := make([]string, 0, fanout)
		for j := 0; j < fanout; j++ {
			externals = append(externals, fmt.Sprintf("node_modules/dep%d/index.d.ts", j))
		}
		edges := map[string][]string{}
		for i, name := range names {
			targets := []string{}
			independentGraphLeaf := cacheStringValue(cfg, "independentGraphLeaf")
			if independentGraphLeaf != "" {
				if "src/"+name != independentGraphLeaf {
					targets = append(targets, externals...)
				}
			} else if cacheBoolValue(cfg, "partitionGraph") {
				targets = append(targets, externals[i%len(externals)])
			} else {
				for _, other := range names {
					if other != name {
						targets = append(targets, "src/"+other)
					}
				}
				targets = append(targets, externals...)
			}
			edges["src/"+name] = targets
		}
		if !cacheBoolValue(cfg, "omitExternalSourceGraphNode") {
			for j := 0; j < int(cacheNumberValue(cfg, "externalSourceOutputs")); j++ {
				edges[fmt.Sprintf("node_modules/external-source/mod%d.ts", j)] = []string{}
			}
		}
		result.Graph = &cacheGraphSection{
			Edges:              edges,
			Globals:            []string{},
			Configs:            []string{"tsconfig.json"},
			InputHashes:        map[string]*string{},
			InputRealpaths:     map[string]*string{},
			InputProofFailures: map[string]string{},
			InputObservations:  map[string]map[string]any{},
		}
		for input, observed := range observedInputs {
			cacheAddGraphInputProof(result.Graph, root, input, observed)
		}
		cacheAddGraphInputProof(result.Graph, root, "tsconfig.json", "")
		for _, input := range externals {
			cacheAddGraphInputProof(result.Graph, root, input, "")
		}
		if cacheBoolValue(cfg, "unhashedGraphInput") {
			result.Graph.InputHashes["node_modules/dep0/index.d.ts"] = nil
		}
		outside := cacheStringValue(cfg, "outOfProjectCandidate")
		if probes := int(cacheNumberValue(cfg, "graphCandidates")); probes > 0 || outside != "" {
			result.Graph.Candidates = map[string][]string{}
			for _, name := range names {
				spellings := make([]string, 0, probes+1)
				for j := 0; j < probes; j++ {
					spellings = append(spellings, fmt.Sprintf("node_modules/dep%d/index.ts", j))
				}
				if outside != "" {
					spellings = append(spellings, outside)
				}
				result.Graph.Candidates["src/"+name] = spellings
			}
		}
		if cacheBoolValue(cfg, "candidateProofFailure") {
			result.Graph.InputProofFailures["node_modules/dep0/index.ts"] = "file-exists-changed"
		}
		if cacheBoolValue(cfg, "richCandidateProof") {
			candidate := "node_modules/dep0/index.ts"
			result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true}
			result.Graph.InputProofFailures[candidate] = "content-unavailable"
			missingCandidate := "node_modules/dep1/index.ts"
			result.Graph.InputObservations[missingCandidate] = map[string]any{"fileExists": false}
		}
		if cacheBoolValue(cfg, "contradictoryRichCandidateProof") {
			candidate := "node_modules/dep0/index.ts"
			file := filepath.Join(root, filepath.FromSlash(candidate))
			data, _ := os.ReadFile(file)
			digest := sha256.Sum256(data)
			observedHash := fmt.Sprintf("%x", digest[:])
			realpath, _ := filepath.EvalSymlinks(file)
			absolute, _ := filepath.Abs(realpath)
			result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true, "stat": "file", "readFile": map[string]any{"ok": true, "hash": observedHash}, "realpath": map[string]any{"ok": true, "path": absolute}}
			cacheAddGraphInputProof(result.Graph, root, candidate, "")
			contradictoryHash := strings.Repeat("0", 64)
			result.Graph.InputHashes[candidate] = &contradictoryHash
		}
		if cacheBoolValue(cfg, "unprojectableContradictoryRichCandidateProof") {
			candidate := "node_modules/dep0/index.ts"
			result.Graph.InputObservations[candidate] = map[string]any{"fileExists": true}
			cacheAddGraphInputProof(result.Graph, root, candidate, "")
		}
		unprovenInputs := int(cacheNumberValue(cfg, "unprovenGraphInputs"))
		if cacheBoolValue(cfg, "unprovenGraphInput") && unprovenInputs == 0 {
			unprovenInputs = 1
		}
		for j := 0; j < unprovenInputs; j++ {
			input := fmt.Sprintf("node_modules/dep%d/index.d.ts", j)
			delete(result.Graph.InputHashes, input)
			delete(result.Graph.InputRealpaths, input)
			result.Graph.InputProofFailures[input] = "content-unavailable"
		}
		if cacheBoolValue(cfg, "aliasedGlobal") {
			alias := "node_modules/global0/alias.d.ts"
			result.Graph.Globals = append(result.Graph.Globals, alias)
			cacheAddGraphInputProof(result.Graph, root, alias, "")
		}
		if cacheBoolValue(cfg, "lexicalCandidateProofFailureAlias") {
			target := "node_modules/candidate-target/index.ts"
			alias := "node_modules/candidate-alias/index.ts"
			if result.Graph.Candidates == nil {
				result.Graph.Candidates = map[string][]string{}
			}
			for _, name := range names {
				result.Graph.Candidates["src/"+name] = append(result.Graph.Candidates["src/"+name], target, alias)
			}
			cacheAddGraphInputProof(result.Graph, root, target, "")
			result.Graph.InputProofFailures[alias] = "content-unavailable"
		}
		for j := 0; j < int(cacheNumberValue(cfg, "graphGlobals")); j++ {
			global := fmt.Sprintf("node_modules/global%d/index.d.ts", j)
			result.Graph.Globals = append(result.Graph.Globals, global)
			cacheAddGraphInputProof(result.Graph, root, global, "")
		}
		if externalRaceFile != "" {
			result.Graph.Edges["src/mod0.ts"] = append(result.Graph.Edges["src/mod0.ts"], externalRaceFile)
			cacheAddGraphInputProof(result.Graph, root, externalRaceFile, externalRaceText)
		}
	}

	data, _ := json.Marshal(result)
	fmt.Fprintln(os.Stdout, string(data))
	return 0
}

func cacheAddGraphInputProof(graph *cacheGraphSection, root, input, observed string) {
	file := input
	if !filepath.IsAbs(file) {
		file = filepath.Join(root, filepath.FromSlash(file))
	}
	data := []byte(observed)
	if observed == "" {
		data, _ = os.ReadFile(file)
	}
	digest := sha256.Sum256(data)
	hash := fmt.Sprintf("%x", digest[:])
	realpath, err := filepath.EvalSymlinks(file)
	if err != nil {
		graph.InputHashes[input] = nil
		graph.InputRealpaths[input] = nil
		return
	}
	absolute, err := filepath.Abs(realpath)
	if err != nil {
		return
	}
	graph.InputHashes[input] = &hash
	graph.InputRealpaths[input] = &absolute
}

func cacheFirstConfig(input string) map[string]any {
	if input == "" {
		return nil
	}
	var plugins []cachePluginDescriptor
	if err := json.Unmarshal([]byte(input), &plugins); err != nil {
		return nil
	}
	if len(plugins) == 0 {
		return nil
	}
	return plugins[0].Config
}

// samePath compares two spellings of one file: the compiler names the
// project physically, after every link, while the test names it as it
// made it, through the macOS temporary directory's link among others.
func cacheSamePath(left, right string) bool {
	physical := func(file string) string {
		resolved, err := filepath.EvalSymlinks(file)
		if err != nil {
			return filepath.Clean(file)
		}
		return resolved
	}
	return physical(left) == physical(right)
}

func cacheStringValue(config map[string]any, key string) string {
	value, _ := config[key].(string)
	return value
}

func cacheBoolValue(config map[string]any, key string) bool {
	value, _ := config[key].(bool)
	return value
}

func cacheNumberValue(config map[string]any, key string) float64 {
	value, _ := config[key].(float64)
	return value
}
