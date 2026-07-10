import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";
import { SHARED_PLUGIN_CACHE_DIR } from "../../internal/plugin-cache";

/**
 * Verifies ttsc linked plugins: paths applies when the host emits through
 * EmitWithPluginTransformers with only its own transform.
 *
 * Locks the regression where a third-party transform host shaped like typia's
 * `ttsc-typia build` — LoadProgram, Diagnostics, then
 * `EmitWithPluginTransformers([own transform])` — never ran the linked plugins
 * compiled into its binary: `@ttsc/paths` registered via init() but its
 * ApplyProgram never fired, so tsconfig paths aliases survived into the emitted
 * JavaScript. The driver must honor linked hooks at the emit funnel itself;
 * hosts do not know which linked packages ttsc merged into them.
 *
 * 1. Configure `@ttsc/paths` alongside a custom executable host whose build
 *    command emits via EmitWithPluginTransformers with its own transform
 *    (numeric 0 -> 100), never calling ApplyLinkedPlugins by hand.
 * 2. Run ttsc with --emit.
 * 3. Assert the emitted main.js carries BOTH the host transform's rewrite and the
 *    paths alias rewrite.
 */
export const test_ttsc_utility_plugins_paths_applies_when_host_emits_with_own_transformers =
  () => {
    const root = TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "bundler",
          strict: true,
          paths: {
            "@lib/*": ["./src/lib/*"],
          },
          outDir: "dist",
          rootDir: "src",
          plugins: [
            { transform: "@ttsc/paths" },
            { transform: "./plugins/emit-host.cjs" },
          ],
        },
        include: ["src"],
      }),
      "plugins/emit-host.cjs": `
        module.exports = (context) => ({
          name: "emit-host",
          source: require("node:path").resolve(
            context.dirname,
            "..",
            "go-host",
            "cmd",
            "emit-host"
          ),
        });
      `,
      "go-host/go.mod": [
        "module example.com/emithost",
        "",
        "go 1.26",
        "",
        "require (",
        "\tgithub.com/microsoft/typescript-go/shim/ast v0.0.0",
        "\tgithub.com/microsoft/typescript-go/shim/printer v0.0.0",
        "\tgithub.com/samchon/ttsc/packages/ttsc v0.0.0",
        ")",
        "",
      ].join("\n"),
      "go-host/cmd/emit-host/main.go": `
        package main

        import (
          "flag"
          "fmt"
          "os"

          shimast "github.com/microsoft/typescript-go/shim/ast"
          shimprinter "github.com/microsoft/typescript-go/shim/printer"
          "github.com/samchon/ttsc/packages/ttsc/driver"
        )

        func main() {
          os.Exit(run(os.Args[1:]))
        }

        func run(args []string) int {
          if len(args) == 0 {
            fmt.Fprintln(os.Stderr, "emit-host: command required")
            return 2
          }
          switch args[0] {
          case "build":
            return runBuild(args[1:])
          case "check":
            return 0
          case "-v", "--version", "version":
            fmt.Fprintln(os.Stdout, "emit-host 0.1.0")
            return 0
          default:
            fmt.Fprintf(os.Stderr, "emit-host: unknown command %q\\n", args[0])
            return 2
          }
        }

        func runBuild(args []string) int {
          fs := flag.NewFlagSet("emit-host", flag.ContinueOnError)
          fs.SetOutput(os.Stderr)
          cwd := fs.String("cwd", "", "project directory")
          tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig")
          _ = fs.String("plugins-json", "", "ordered plugin descriptors")
          emit := fs.Bool("emit", false, "force emit")
          _ = fs.Bool("noEmit", false, "force no emit")
          outDir := fs.String("outDir", "", "out dir")
          _ = fs.Bool("quiet", false, "quiet")
          _ = fs.Bool("verbose", false, "verbose")
          if err := fs.Parse(args); err != nil {
            return 2
          }
          root := *cwd
          if root == "" {
            var err error
            root, err = os.Getwd()
            if err != nil {
              fmt.Fprintf(os.Stderr, "emit-host: cwd: %v\\n", err)
              return 2
            }
          }
          prog, diags, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{
            ForceEmit: *emit,
            OutDir:    *outDir,
          })
          if err != nil {
            fmt.Fprintf(os.Stderr, "emit-host: %v\\n", err)
            return 2
          }
          if len(diags) > 0 {
            for _, diag := range diags {
              fmt.Fprintln(os.Stderr, diag.String())
            }
            return 2
          }
          defer prog.Close()
          if diags := prog.Diagnostics(); len(diags) > 0 {
            for _, diag := range diags {
              fmt.Fprintln(os.Stderr, diag.String())
            }
            return 2
          }
          // The typia-host shape under regression test: only the host's own
          // transform is passed; linked plugins must still be honored by the
          // driver's emit funnel.
          hostTransform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
            var v *shimast.NodeVisitor
            visit := func(n *shimast.Node) *shimast.Node {
              if n != nil && n.Kind == shimast.KindNumericLiteral && n.Text() == "0" {
                return ec.Factory.NewNumericLiteral("100", 0)
              }
              return v.VisitEachChild(n)
            }
            v = ec.NewNodeVisitor(visit)
            return v.VisitSourceFile(sf)
          }
          if _, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{hostTransform}, nil); err != nil {
            fmt.Fprintf(os.Stderr, "emit-host: emit: %v\\n", err)
            return 3
          }
          return 0
        }
      `,
      "src/lib/value.ts": `export const value = "ok";\n`,
      "src/main.ts": [
        `import { value } from "@lib/value";`,
        `export const result = value;`,
        `export const marker = 0;`,
        ``,
      ].join("\n"),
    });
    TestUtilityPlugins.seedPackages(root, ["paths"]);
    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["--cwd", root, "--emit"],
      {
        cwd: root,
        env: {
          PATH: TestUtilityPlugins.goPath(),
          TTSC_CACHE_DIR: SHARED_PLUGIN_CACHE_DIR,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const main = fs.readFileSync(path.join(root, "dist", "main.js"), "utf8");
    assert.match(main, /from "\.\/lib\/value\.js"/);
    assert.match(main, /marker = 100/);
  };
