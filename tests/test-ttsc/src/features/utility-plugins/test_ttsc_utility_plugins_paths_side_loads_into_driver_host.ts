import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { TestUtilityPlugins } from "../../internal/TestUtilityPlugins";

/**
 * Verifies ttsc linked plugins: paths side-loads into a driver host.
 *
 * Locks the mixed-host regression where one linked transform and one executable
 * transform resolved to separate native binaries. The linked source must not
 * become the compiler owner; it is applied inside the selected
 * driver.LoadProgram host.
 *
 * 1. Put `@ttsc/paths` before a custom driver-based transform plugin.
 * 2. Run ttsc so host selection cannot depend on descriptor order.
 * 3. Assert the custom host ran and emitted imports were path-rewritten.
 */
export const test_ttsc_utility_plugins_paths_side_loads_into_driver_host =
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
            { transform: "./plugins/driver-host.cjs" },
          ],
        },
        include: ["src"],
      }),
      "plugins/driver-host.cjs": `
        module.exports = {
          name: "driver-host",
          source: require("node:path").resolve(
            __dirname,
            "..",
            "go-host",
            "cmd",
            "driver-host"
          ),
        };
      `,
      "go-host/go.mod": [
        "module example.com/driverhost",
        "",
        "go 1.26",
        "",
        "require github.com/samchon/ttsc/packages/ttsc v0.0.0",
        "",
      ].join("\n"),
      "go-host/cmd/driver-host/main.go": `
        package main

        import (
          "flag"
          "fmt"
          "os"
          "path/filepath"

          "github.com/samchon/ttsc/packages/ttsc/driver"
        )

        func main() {
          os.Exit(run(os.Args[1:]))
        }

        func run(args []string) int {
          if len(args) == 0 {
            fmt.Fprintln(os.Stderr, "driver-host: command required")
            return 2
          }
          switch args[0] {
          case "build":
            return runBuild(args[1:])
          case "check":
            return runCheck(args[1:])
          case "transform":
            fmt.Fprintln(os.Stderr, "driver-host: transform is not implemented")
            return 2
          case "-v", "--version", "version":
            fmt.Fprintln(os.Stdout, "driver-host 0.1.0")
            return 0
          default:
            fmt.Fprintf(os.Stderr, "driver-host: unknown command %q\\n", args[0])
            return 2
          }
        }

        func runCheck(args []string) int {
          return runProgram(args, true)
        }

        func runBuild(args []string) int {
          return runProgram(args, false)
        }

        func runProgram(args []string, forceNoEmit bool) int {
          fs := flag.NewFlagSet("driver-host", flag.ContinueOnError)
          fs.SetOutput(os.Stderr)
          cwd := fs.String("cwd", "", "project directory")
          tsconfig := fs.String("tsconfig", "tsconfig.json", "tsconfig")
          _ = fs.String("plugins-json", "", "ordered plugin descriptors")
          emit := fs.Bool("emit", false, "force emit")
          noEmit := fs.Bool("noEmit", false, "force no emit")
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
              fmt.Fprintf(os.Stderr, "driver-host: cwd: %v\\n", err)
              return 2
            }
          }
          prog, diags, err := driver.LoadProgram(root, *tsconfig, driver.LoadProgramOptions{
            ForceEmit:   *emit,
            ForceNoEmit: *noEmit || forceNoEmit,
            OutDir:      *outDir,
          })
          if err != nil {
            fmt.Fprintf(os.Stderr, "driver-host: %v\\n", err)
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
          if *noEmit || forceNoEmit {
            return 0
          }
          if err := os.WriteFile(filepath.Join(root, "driver-host-ran.txt"), []byte("ok"), 0o644); err != nil {
            fmt.Fprintf(os.Stderr, "driver-host: marker: %v\\n", err)
            return 2
          }
          _, emitDiags, err := prog.EmitAllRaw(nil)
          if err != nil {
            fmt.Fprintf(os.Stderr, "driver-host: emit: %v\\n", err)
            return 3
          }
          for _, diag := range emitDiags {
            fmt.Fprintln(os.Stderr, "  -", diag.String())
          }
          if driver.CountErrors(emitDiags) > 0 {
            return 2
          }
          return 0
        }
      `,
      "src/lib/value.ts": `export const value = "ok";\n`,
      "src/main.ts": [
        `import { value } from "@lib/value";`,
        `export const result = value;`,
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
          TTSC_CACHE_DIR: TestProject.tmpdir("ttsc-utility-driver-host-"),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(path.join(root, "driver-host-ran.txt"), "utf8"),
      "ok",
    );
    assert.match(
      fs.readFileSync(path.join(root, "dist", "main.js"), "utf8"),
      /from "\.\/lib\/value\.js"/,
    );
  };
