import { TestProject } from "@ttsc/testing";
import fs from "node:fs";
import path from "node:path";

import { TtsgraphClient, assert } from "./ttsgraph";

let preparation: Promise<{ client: TtsgraphClient; root: string }> | undefined;

/** Borrow the compiler identity project shared by nine named cases. */
export async function withIdentityBoundary(
  body: (client: TtsgraphClient, root: string) => Promise<void>,
): Promise<void> {
  preparation ??= prepare();
  const { client, root } = await preparation;
  await body(client, root);
}

/** The suite releases its borrowed MCP process after every selected case runs. */
export async function closeIdentityBoundary(): Promise<void> {
  if (preparation === undefined) return;
  const pending = preparation;
  preparation = undefined;
  const { client } = await pending;
  client.endStdin();
  const code = await client.waitForExit();
  assert.equal(code, 0, client.stderrText());
}

async function prepare(): Promise<{ client: TtsgraphClient; root: string }> {
  const members = Array.from(
      { length: 20 },
      (_, i) => `  m${String(i)}(): void {}`,
    );
  const literals = Array.from(
      { length: 20 },
      (_, i) => `'v${String(i)}'`,
    ).join(" | ");
  const users = Array.from(
      { length: 20 },
      (_, i) => `export function u${String(i)}(w: Wide): void { void w; }`,
    );
    const before = [
      "const shorthand = 1;",
      'const dynamic = Math.random() > 0.5 ? "a" : "b";',
      "const spread = { fromSpread: true };",
      "",
      "export const shape = (({",
      "  /* { */",
      "  real: 1,",
      '  close: "}",',
      '  text: "{",',
      "  shorthand,",
      '  ["static-key"]: 2,',
      '  [""]: 4,',
      "  [1]: true,",
      "  [dynamic]: 3,",
      '  method() { return "METHOD_BODY_MUST_NOT_APPEAR"; },',
      '  get value() { return "ACCESSOR_BODY_MUST_NOT_APPEAR"; },',
      '  set value(input: number) { void "SETTER_BODY_MUST_NOT_APPEAR"; },',
      '  run: () => "ARROW_BODY_MUST_NOT_APPEAR",',
      '  classic: function () { return "FUNCTION_BODY_MUST_NOT_APPEAR"; },',
      '  klass: class { method() { return "CLASS_BODY_MUST_NOT_APPEAR"; } },',
      '  list: ["ARRAY_CONTENT_MUST_NOT_APPEAR"],',
      '  nested: { inner: "NESTED_BODY_MUST_NOT_APPEAR" },',
      "  ...spread,",
      "  /* } */",
      "  afterSpread: true,",
      "}) as const) satisfies Record<PropertyKey, unknown>;",
      "",
    ].join("\n");
    const source = (name: string, terminator = "\n") =>
      [
        `/** ${name} docs. */`,
        `export function ${name}(): string {`,
        `  return "${name}";`,
        "}",
        "",
      ].join(terminator);
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        strict: true,
        rootDir: "src",
        outDir: "dist",
      },
      include: ["src"],
    }),
      "src/addresses.ts": [
        "/** @evidence docs/pricing.md#sale Implements the pricing rule. */",
        "export function priced(): void {}",
        "",
        "/** @todo Add caching here. */",
        "export function cached(): void {}",
        "",
        "/** @default 4 */",
        "export const retries = 4;",
        "",
        "/** @reference https://example.com/spec#part Background reading. */",
        "export function referenced(): void {}",
        "",
        "/** A function whose name is the prose word. */",
        "export function Add(): void {}",
        "",
        "/** @evidence 문서/가격.md#할인 A non-Latin address. */",
        "export function nonAscii(): void {}",
        "",
        "/** @evidence */",
        "export function bareTag(): void {}",
        "",
      ].join("\n"),
      "src/notice.ts": [
        "/**",
        " * Renders the stacking notice.",
        " *",
        " * @evidence docs/discount.md#coupon-stacking States the per-issuer",
        " *           stacking limit this section defines.",
        " * @evidence POST:/orders/{orderId}/coupons Explains the rejection.",
        " */",
        "export function renderNotice(): string {",
        "  return 'notice';",
        "}",
        "",
      ].join("\n"),
      "src/checkout.ts": [
        "/** @evidence docs/discount.md#coupon-stacking Enforces the same limit. */",
        "export function applyCoupons(): number {",
        "  return 0;",
        "}",
        "",
        "/** @reference https://example.com/spec Background reading. */",
        "export function documented(): void {}",
        "",
        "/** Carries no tag at all. */",
        "export function untagged(): void {}",
        "",
      ].join("\n"),
      "src/document-links.ts": [
        "export interface ICited {",
        "  note: string;",
        "}",
        "",
        "export interface IUsed {",
        "  value: number;",
        "}",
        "",
        "export function helper(): void {}",
        "",
        "/**",
        " * Renders the notice.",
        " *",
        " * @evidence {@link ICited} The contract this mirrors.",
        " */",
        "export function DocLinkedNotice(input: IUsed): void {",
        "  helper();",
        "}",
        "",
      ].join("\n"),
    "src/object-outline.ts": before,
    "src/identity0.ts": [
        "export enum Colors {",
        "  Red = 'red',",
        "  Green = 'green',",
        "  Blue = 'blue',",
        "}",
        "",
        "export enum Implicit {",
        "  First,",
        "  Second,",
        "}",
        "",
        "// Two members, one value: a type folds these, a declaration does not.",
        "export enum Dup {",
        "  A = 'x',",
        "  B = 'x',",
        "}",
        "",
        "export class Cls {",
        "  public run(): void {}",
        "}",
        "",
      ].join("\n"),
    "src/identity1.ts": [
        "export class Wide {",
        ...members,
        "}",
        "",
        `export type Values = ${literals};`,
        "",
        ...users,
        "",
      ].join("\n"),
    "src/identity2.ts": [
        "export type Wrapped =",
        "  | 'a'",
        "  | 'b'",
        "  | 'c'",
        "  | 'd'",
        "  | 'e'",
        "  | 'f'",
        "  | 'g';",
        "",
        "export type Flat = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';",
        "",
        "export enum LiteralColors {",
        "  Red = 'red',",
        "  Green = 'green',",
        "  Blue = 'blue',",
        "}",
        "",
        "export type Indirect = Wrapped | 'h';",
        "",
        "export type Widened = Wrapped | string;",
        "",
      ].join("\n"),
    "src/identity3.ts": [
      "export function oneLiner(n: number): number { return n * 2; }",
      "",
      "export function withTypeLiteral(options: {",
      "  host: string;",
      "  port: number;",
      "}): Promise<void> {",
      "  return Promise.resolve();",
      "}",
      "",
    ].join("\n"),
  });
    fs.writeFileSync(
      path.join(root, "src", "Utf8Bom.ts"),
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(source("Utf8Bom")),
      ]),
    );
    fs.writeFileSync(
      path.join(root, "src", "Utf16Le.ts"),
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(source("Utf16Le"), "utf16le"),
      ]),
    );
    fs.writeFileSync(
      path.join(root, "src", "Utf16Be.ts"),
      utf16be(source("Utf16Be")),
    );

    for (const [name, terminator] of [["Lf", "\n"], ["CrLf", "\r\n"], ["Cr", "\r"], ["Ls", "\u2028"], ["Ps", "\u2029"]] as const) {
      fs.writeFileSync(path.join(root, "src", `${name}.ts`), source(name, terminator));
    }
  const client = TtsgraphClient.start(root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-graph", version: "0.0.0" },
    });
    client.notify("notifications/initialized", {});
    return { client, root };
  } catch (error) {
    client.endStdin();
    await client.waitForExit();
    throw error;
  }
}

const utf16be = (text: string): Buffer =>
  Buffer.concat([
    Buffer.from([0xfe, 0xff]),
    Buffer.from(text, "utf16le").swap16(),
  ]);
