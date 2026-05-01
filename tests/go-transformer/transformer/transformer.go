package transformer

import (
	"fmt"
	"regexp"
	"strings"
)

var goUpperCall = regexp.MustCompile(`(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*goUpper\("([^"]*)"\)\s*;`)

type Result struct {
	Code string
}

type Plugin struct {
	Config    map[string]any
	Operation string
	Name      string
}

func Transform(source string, plugins []Plugin) (Result, error) {
	match := goUpperCall.FindStringSubmatch(source)
	if match == nil {
		return Result{}, fmt.Errorf(`go transformer: expected export const value = goUpper("...")`)
	}
	name := match[1]
	value := match[2]
	if len(plugins) == 0 {
		plugins = []Plugin{{Operation: "go-uppercase"}}
	}
	for _, plugin := range plugins {
		switch plugin.Operation {
		case "go-uppercase":
			value = strings.ToUpper(value)
		case "go-prefix":
			value = stringConfig(plugin.Config, "prefix") + value
		case "go-suffix":
			value += stringConfig(plugin.Config, "suffix")
		default:
			return Result{}, fmt.Errorf("go transformer: unsupported operation %q", plugin.Operation)
		}
	}
	var builder strings.Builder
	builder.WriteString(`"use strict";` + "\n")
	builder.WriteString(`Object.defineProperty(exports, "__esModule", { value: true });` + "\n")
	builder.WriteString(fmt.Sprintf("exports.%s = void 0;\n", name))
	builder.WriteString(fmt.Sprintf("const %s = %q;\n", name, value))
	builder.WriteString(fmt.Sprintf("exports.%s = %s;\n", name, name))
	if strings.Contains(source, "console.log("+name+")") || strings.Contains(source, "console.log("+name+");") {
		builder.WriteString(fmt.Sprintf("console.log(%s);\n", name))
	}
	return Result{Code: builder.String()}, nil
}

func stringConfig(config map[string]any, key string) string {
	if config == nil {
		return ""
	}
	value, _ := config[key].(string)
	return value
}
