interface I {
  // expect: noMisusedNew error
  constructor(): void;
}
declare const i: I;
JSON.stringify(i);
