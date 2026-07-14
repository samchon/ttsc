package linthost

import "testing"

// TestUnicornNoUnusedPropertiesTypeLiteralSemantics verifies the TypeScript
// half of the upstream analysis: inline type-literal containers on parameters
// and variable declarations.
//
// Upstream only analyzes an annotation when it is a literal `{...}` type on
// an identifier (named aliases and interfaces are opaque), prefers an
// object-literal initializer over the annotation, filters non-property
// members (methods, index/call signatures), and sees through TypeScript
// expression wrappers when following reference chains. Each arm below pins
// one of those decisions with a used/unused pair.
//
//  1. Declare parameters and variables covering annotation containers,
//     initializer priority, assertion wrappers, and signature filtering.
//  2. Run the rule through the real Program/checker lifecycle.
//  3. Assert exactly the `/* unused:NAME */`-marked members are reported.
func TestUnicornNoUnusedPropertiesTypeLiteralSemantics(t *testing.T) {
  source := `export {};
declare function consume(...values: unknown[]): void;
declare function getArgs(): { x: number; y: number };

function partial(args: { x: number; /* unused:y */ y: number }): number {
  return args.x * 2;
}
consume(partial);

function wholeEscape(args: { x: number; y: number }): void {
  consume(args);
}
consume(wholeEscape);

function dynamicKey(args: { x: number; y: number }, key: "x" | "y"): number {
  return args[key];
}
consume(dynamicKey);

function written(args: { x: number; y: number }): void {
  args.x = 1;
}
consume(written);

function calledMember(args: { x: () => void; y: number }): void {
  args.x();
}
consume(calledMember);

type Named = { x: number; y: number };
function namedAlias(args: Named): number {
  return args.x;
}
consume(namedAlias);

interface Shaped {
  x: number;
  y: number;
}
function viaInterface(args: Shaped): number {
  return args.x;
}
consume(viaInterface);

function destructuredParam({ x }: { x: number; y: number }): number {
  return x;
}
consume(destructuredParam);

function filteredMembers(args: {
  x: number;
  method(): void;
  [key: string]: unknown;
}): unknown {
  return args.x;
}
consume(filteredMembers);

function nestedSignature(args: {
  options: {
    enabled: boolean;
    /* unused:disabledFlag */ disabledFlag: boolean;
  };
  label: string;
}): boolean {
  return args.options.enabled && args.label.length > 0;
}
consume(nestedSignature);

function nonNullChain(args: {
  x: {
    a: number;
    /* unused:b */ b: number;
  };
  /* unused:tail */ tail: number;
}): number {
  return args.x!.a;
}
consume(nonNullChain);

function castChain(args: {
  x: {
    a: number;
    /* unused:castB */ castB: number;
  };
  /* unused:castTail */ castTail: number;
}): number {
  return (args.x as { a: number; castB: number }).a;
}
consume(castChain);

const annotated: { x: number; /* unused:annotatedY */ annotatedY: number } = getArgs() as never;
consume(annotated.x);

const initWins: { x: number; initY: number } = { x: 1, /* unused:initY */ initY: 2 };
consume(initWins.x);

const asConst = { x: 1, /* unused:constY */ constY: 2 } as const;
consume(asConst.x);

const satisfied = { x: 1, /* unused:satisfiedY */ satisfiedY: 2 } satisfies {
  x: number;
  satisfiedY: number;
};
consume(satisfied.x);

declare const ambient: { x: number; y: number };
consume(ambient.x);

let uninitialized: { x: number; y: number };
uninitialized = getArgs();
consume(uninitialized.x);

class Holder {
  constructor(private args: { x: number; /* unused:holderY */ holderY: number }) {
    consume(args.x);
  }
}
consume(new Holder({ x: 1, holderY: 2 }));

class ThisOnly {
  constructor(private args: { x: number; y: number }) {}
  read(): number {
    return this.args.x;
  }
}
consume(new ThisOnly({ x: 1, y: 2 }).read());
`
  assertUnusedPropertiesFindings(t, source)
}
