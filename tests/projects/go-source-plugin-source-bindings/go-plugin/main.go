// Source-binding source plugin fixture.
//
// The plugin emits CommonJS that mirrors TypeScript's import-rewrite shape but
// intentionally leaves source-level identifiers in the transformed expression.
// `ttsx` must restore those bindings at runtime.
package main

import (
  "flag"
  "fmt"
  "os"
  "path/filepath"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "go-source-plugin-source-bindings: command required")
    return 2
  }
  switch args[0] {
  case "-v", "--version", "version":
    fmt.Fprintln(os.Stdout, "go-source-plugin-source-bindings 0.0.0-test")
    return 0
  case "build":
    return runBuild(args[1:])
  case "check":
    return 0
  default:
    fmt.Fprintf(os.Stderr, "go-source-plugin-source-bindings: unknown command %q\n", args[0])
    return 2
  }
}

func runBuild(args []string) int {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "")
  _ = fs.String("tsconfig", "", "")
  _ = fs.String("plugins-json", "", "")
  _ = fs.Bool("emit", false, "")
  _ = fs.Bool("quiet", false, "")
  _ = fs.Bool("verbose", false, "")
  _ = fs.Bool("noEmit", false, "")
  outDir := fs.String("outDir", "dist", "")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  if _, err := os.Stat(filepath.Join(root, "src", "main.ts")); err != nil {
    fmt.Fprintf(os.Stderr, "go-source-plugin-source-bindings: read src/main.ts: %v\n", err)
    return 2
  }
  files := map[string]string{
    "main.js": `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.total = void 0;
const Calculator_1 = require("./Calculator");
const DefaultCounter_1 = require("./DefaultCounter");
const Namespaced_1 = require("./Namespaced");
const Shadow_1 = require("./Shadow");
// const CommentOnly_1 = require("./CommentOnly");
const ShadowedLocal = "plugin-local";
const total = new Calc().add(2, 3) + new DefaultCounter().value + CounterBase + Offset.value + new NamespacedDefault().value + Namespaced.namespaceValue;
exports.total = total;
console.log(String(total) + ":" + ShadowedLocal + ":" + typeof CommentOnly + ":" + String(true));
void Shadow_1;
`,
    "Calculator.js": `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Offset = exports.Calculator = void 0;
class Calculator {
  add(left, right) {
    return left + right;
  }
}
exports.Calculator = Calculator;
exports.Offset = { value: 11 };
`,
    "DefaultCounter.js": `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseValue = exports.default = void 0;
class DefaultCounter {
  constructor() {
    this.value = 7;
  }
}
exports.default = DefaultCounter;
exports.BaseValue = 13;
`,
    "Namespaced.js": `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.namespaceValue = exports.default = void 0;
class NamespacedDefault {
  constructor() {
    this.value = 17;
  }
}
exports.default = NamespacedDefault;
exports.namespaceValue = 19;
`,
    "Shadow.js": `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShadowedLocal = void 0;
exports.ShadowedLocal = "imported";
`,
  }
  for name, content := range files {
    out := filepath.Join(root, *outDir, name)
    if filepath.IsAbs(*outDir) {
      out = filepath.Join(*outDir, name)
    }
    if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
    if err := os.WriteFile(out, []byte(content), 0o644); err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  return 0
}
