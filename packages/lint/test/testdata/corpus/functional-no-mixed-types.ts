type Mixed = {
  value: number;
  // expect: functional/no-mixed-types error
  compute(): number;
};

declare const m: Mixed;
JSON.stringify(m);
