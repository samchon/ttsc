interface I {
  foo(): void;
  bar(): void;
  // expect: typescript/adjacent-overload-signatures error
  foo(x: number): void;
}
declare const i: I;
JSON.stringify(i);
