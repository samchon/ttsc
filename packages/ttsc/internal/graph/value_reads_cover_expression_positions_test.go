package graph

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// Verifies named value uses survive their expression position.
//
// 1. Load isolated readers, destructuring and JSX properties with invocation and type-only controls.
// 2. Build checker-resolved relations from one TSX Program.
// 3. Require each actual reader and reject type-only, label and declaration-name dependencies.
//
// @evidence contracts/testing.md#behavioral-verification Build must record accesses to num, Props.label and Color from every authored reader, while preserving call edges without duplicate accesses and excluding type-only syntax.
// @evidence contracts/testing.md#independent-expectations Each literal function body independently determines whether it reads the named module value or property. Expected relationships are authored pairs rather than a snapshot of the extractor's output.
// @evidence contracts/testing.md#distinguishing-cases Return, arithmetic, condition, array, object, shorthand, template, assignment, anonymous closure, destructured aliases/defaults/parameters, JSX and enum uses contrast declaration names, labels, shadowed locals, type queries and direct calls. Existing tests own ordinary dotted and bracket access, dispatch and external leaves.
// @evidence contracts/testing.md#execution-ownership This Go unit owns a temporary TSX project, loads and closes its compiler Program and calls Build directly; no native binary, installed consumer or agent query is launched.
func TestValueReadsCoverExpressionPositions(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"strict":true,"target":"ES2022","module":"commonjs","jsx":"preserve"},"include":["src"]}`)
  writeFile(t, filepath.Join(root, "src", "main.tsx"), "declare global { namespace JSX { type Element = unknown; interface IntrinsicElements {} } }\n"+`export const num = 1;
export enum Color { Red }
export interface Props { label: number }
export function Badge(props: Props) { return null; }
export function asArgument() { return String(num); }
export function returned() { return num; }
export function added() { return num + 1; }
export function tested() { if (num) return 1; return 0; }
export function inArray() { return [num]; }
export function inObject() { return { key: num }; }
export function shorthand() { return { num }; }
export function inTemplate() { return `+"`${num}`"+`; }
export function assigned() { const copy = num; return copy; }
export function closure() { return () => num; }
export function dotted(props: Props) { return props.label; }
export function destructured(props: Props) { const { label } = props; return label; }
export function renamed(props: Props) { const { label: renamed = num } = props; return renamed; }
export function parameter({ label }: Props) { return label; }
export function jsxAttribute() { return <Badge label={1} />; }
export function enumMember() { return Color.Red; }
export function enumBracket() { return Color["Red"]; }
export function invoked() { return Badge({ label: 1 }); }
export function onlyTypes(value: typeof num): Props { return { label: value }; }
export type OnlyType = { [num]: typeof num };
export function shadowed() { const num = 2; return num; }
export function labels() { num: for (;;) { break num; } }
`)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  defer func() { _ = prog.Close() }()
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  g := Build(prog)
  file := sourceFile(t, prog, "main.tsx").FileName()
  for _, reader := range []string{"asArgument", "returned", "added", "tested", "inArray", "inObject", "shorthand", "inTemplate", "assigned", "closure", "renamed"} {
    if !hasEdge(g, nodeID(file, reader, NodeFunction), nodeID(file, "num", NodeVariable), EdgeValueAccess) {
      t.Errorf("%s lost num read", reader)
    }
  }
  for _, reader := range []string{"dotted", "destructured", "renamed", "parameter", "jsxAttribute"} {
    if !hasEdge(g, nodeID(file, reader, NodeFunction), nodeID(file, "Props.label", NodeVariable), EdgeValueAccess) {
      t.Errorf("%s lost Props.label read", reader)
    }
  }
  for _, reader := range []string{"enumMember", "enumBracket"} {
    if !hasEdge(g, nodeID(file, reader, NodeFunction), nodeID(file, "Color", NodeEnum), EdgeValueAccess) {
      t.Errorf("%s lost enum read", reader)
    }
  }
  for _, reader := range []string{"onlyTypes", "shadowed", "labels"} {
    if hasEdge(g, nodeID(file, reader, NodeFunction), nodeID(file, "num", NodeVariable), EdgeValueAccess) {
      t.Errorf("%s invented num read", reader)
    }
  }
  if hasEdge(g, nodeID(file, "OnlyType", NodeTypeAlias), nodeID(file, "num", NodeVariable), EdgeValueAccess) {
    t.Error("type-literal computed name invented a runtime read")
  }
  from, to := nodeID(file, "invoked", NodeFunction), nodeID(file, "Badge", NodeFunction)
  if !hasEdge(g, from, to, EdgeValueCall) || hasEdge(g, from, to, EdgeValueAccess) {
    t.Error("direct invocation must retain only its call edge")
  }
}
