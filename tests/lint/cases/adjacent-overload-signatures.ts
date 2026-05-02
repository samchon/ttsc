interface I {
  foo(): void;
  bar(): void;
  // expect: adjacent-overload-signatures error
  foo(x: number): void;
}
declare const i: I;
JSON.stringify(i);