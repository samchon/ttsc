interface I {
  // expect: no-misused-new error
  constructor(): void;
}
declare const i: I;
JSON.stringify(i);
