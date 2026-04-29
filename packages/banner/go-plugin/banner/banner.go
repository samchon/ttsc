package banner

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const modeBanner = "ttsc-banner"

type pluginEntry struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

func RunOutput(args []string) int {
	fs := flag.NewFlagSet("output", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "emitted file to transform")
	out := fs.String("out", "", "write transformed text to this file instead of updating --file")
	_ = fs.String("cwd", "", "project directory")
	_ = fs.String("outDir", "", "emit directory override")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin manifest JSON")
	_ = fs.String("rewrite-mode", modeBanner, "native mode")
	_ = fs.String("tsconfig", "tsconfig.json", "project tsconfig")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "@ttsc/banner: output requires --file")
		return 2
	}
	config, err := findConfig(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	text, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/banner: read %s: %v\n", *file, err)
		return 2
	}
	patched, err := Apply(*file, string(text), config)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	target := *file
	if *out != "" {
		target = *out
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/banner: mkdir: %v\n", err)
		return 2
	}
	if err := os.WriteFile(target, []byte(patched), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "@ttsc/banner: write %s: %v\n", target, err)
		return 2
	}
	return 0
}

func Apply(fileName string, text string, config map[string]any) (string, error) {
	if !isBannerableOutput(fileName) {
		return text, nil
	}
	banner, err := parseBanner(config)
	if err != nil {
		return "", err
	}
	if strings.HasPrefix(text, banner) {
		return text, nil
	}
	return banner + text, nil
}

func parseBanner(config map[string]any) (string, error) {
	raw, ok := config["banner"]
	if !ok {
		return "", fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
	}
	text, ok := raw.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return "", fmt.Errorf("@ttsc/banner: \"banner\" must be a non-empty string")
	}
	if !strings.HasSuffix(text, "\n") {
		text += "\n"
	}
	return text, nil
}

func findConfig(pluginsJSON string) (map[string]any, error) {
	if strings.TrimSpace(pluginsJSON) == "" {
		return nil, fmt.Errorf("@ttsc/banner: missing --plugins-json")
	}
	var entries []pluginEntry
	if err := json.Unmarshal([]byte(pluginsJSON), &entries); err != nil {
		return nil, fmt.Errorf("@ttsc/banner: invalid --plugins-json: %w", err)
	}
	for _, entry := range entries {
		if entry.Mode == modeBanner || entry.Name == "@ttsc/banner" {
			if entry.Config == nil {
				return map[string]any{}, nil
			}
			return entry.Config, nil
		}
	}
	return nil, fmt.Errorf("@ttsc/banner: plugin entry not found")
}

func isBannerableOutput(fileName string) bool {
	lower := strings.ToLower(fileName)
	if strings.HasSuffix(lower, ".map") || strings.HasSuffix(lower, ".tsbuildinfo") {
		return false
	}
	return isJavaScriptOutput(fileName) || isDeclarationOutput(fileName)
}

func isJavaScriptOutput(fileName string) bool {
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return false
	}
}

func isDeclarationOutput(fileName string) bool {
	lower := strings.ToLower(fileName)
	return strings.HasSuffix(lower, ".d.ts") ||
		strings.HasSuffix(lower, ".d.mts") ||
		strings.HasSuffix(lower, ".d.cts")
}
