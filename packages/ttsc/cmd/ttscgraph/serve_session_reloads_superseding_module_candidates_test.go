package main

import (
  "path/filepath"
  "testing"
)

// TestServeSessionReloadsSupersedingModuleCandidates verifies a resident
// session reloads when an unchanged specifier gains a missing candidate that
// outranks the file TypeScript-Go selected for the first snapshot.
//
// A resident session cannot rely on a changed importer or tsconfig to notice a
// resolution precedence change. Each case pins a distinct resolver family while
// preserving both files between observations.
//
//  1. Load a project whose specifier resolves to the lower-priority target.
//  2. Create only the absent target that precedes it in that resolver's search.
//  3. Assert the resident snapshot reloads and exposes the new target when one
//     carries a distinguishing declaration.
func TestServeSessionReloadsSupersedingModuleCandidates(t *testing.T) {
  cases := []struct {
    name  string
    setup func(*testing.T, string) string
    add   func(*testing.T, string)
  }{
    {
      name: "relative_extension",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "ES2022" },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from './value';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "src", "value.js"), "export function winner() {}\n")
        return "typescriptWinner"
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "src", "value.ts"), "export function winner(): void {}\nexport function typescriptWinner(): void {}\n")
      },
    },
    {
      name: "ordered_paths",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "baseUrl": ".",
    "module": "commonjs",
    "paths": { "@generated/*": ["first/*", "fallback/*"] },
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from '@generated/value';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "fallback", "value.ts"), "export function winner(): void {}\n")
        return "firstPathsWinner"
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "first", "value.ts"), "export function winner(): void {}\nexport function firstPathsWinner(): void {}\n")
      },
    },
    {
      name: "root_dirs",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "module": "commonjs",
    "rootDirs": ["src", "generated"],
    "target": "ES2022"
  },
  "files": ["src/views/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "views", "main.ts"), "import { winner } from './template';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "generated", "views", "template.ts"), "export function winner(): void {}\n")
        return "rootDirsWinner"
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "src", "views", "template.ts"), "export function winner(): void {}\nexport function rootDirsWinner(): void {}\n")
      },
    },
    {
      name: "nearer_node_modules",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "ES2022" },
  "files": ["src/deep/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "deep", "main.ts"), "import { winner } from 'fixture-package';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "index.js"), "export function winner() {}\n")
        return "nearerNodeModulesWinner"
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "src", "node_modules", "fixture-package", "index.ts"), "export function winner(): void {}\nexport function nearerNodeModulesWinner(): void {}\n")
      },
    },
    {
      name: "package_exports",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from 'fixture-package/feature';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": { "./feature": ["./dist/first.js", "./dist/fallback.js"] }
}`)
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "fallback.js"), "export function winner() {}\n")
        return ""
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "first.js"), "export function winner() {}\nexport function exportsWinner() {}\n")
      },
    },
    {
      name: "conditional_package_exports",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from 'fixture-package/feature';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "package.json"), `{
  "name": "fixture-package",
  "exports": {
    "./feature": {
      "types": "./dist/types.d.ts",
      "default": "./dist/fallback.js"
    }
  }
}`)
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "fallback.js"), "export function winner() {}\n")
        return ""
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "node_modules", "fixture-package", "dist", "types.d.ts"), "export declare function winner(): void;\n")
      },
    },
    {
      name: "conditional_package_imports",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "package.json"), `{
  "name": "fixture-project",
  "imports": {
    "#feature": {
      "types": "./generated/types.d.ts",
      "default": "./generated/fallback.js"
    }
  }
}`)
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "allowJs": true,
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "ES2022"
  },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from '#feature';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "generated", "fallback.js"), "export function winner() {}\n")
        return ""
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "generated", "types.d.ts"), "export declare function winner(): void;\n")
      },
    },
    {
      name: "file_over_directory_index",
      setup: func(t *testing.T, root string) string {
        writeGraphFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "ES2022" },
  "files": ["src/main.ts"]
}`)
        writeGraphFile(t, filepath.Join(root, "src", "main.ts"), "import { winner } from './feature';\nexport function main(): void { winner(); }\n")
        writeGraphFile(t, filepath.Join(root, "src", "feature", "index.js"), "export function winner() {}\n")
        return "fileWinner"
      },
      add: func(t *testing.T, root string) {
        writeGraphFile(t, filepath.Join(root, "src", "feature.js"), "export function winner() {}\nexport function fileWinner() {}\n")
      },
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      root := t.TempDir()
      want := test.setup(t, root)
      session, err := newGraphSession(root, "tsconfig.json")
      if err != nil {
        t.Fatal(err)
      }
      defer session.Close()
      if _, _, _, err := session.Snapshot(); err != nil {
        t.Fatal(err)
      }

      test.add(t, root)
      dump, mode, changed, err := session.Snapshot()
      if err != nil {
        t.Fatal(err)
      }
      if dump == nil || mode != serveModeReload || !changed || (want != "" && !hasDumpNode(*dump, want)) {
        t.Fatalf("superseding candidate = dump:%v mode:%q changed:%v want-node:%q", dump != nil, mode, changed, want)
      }
    })
  }
}
