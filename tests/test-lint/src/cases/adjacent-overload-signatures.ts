interface I {
  foo(): void;
  bar(): void;
  // expect: adjacentOverloadSignatures error
  foo(x: number): void;
}
declare const i: I;
JSON.stringify(i);
