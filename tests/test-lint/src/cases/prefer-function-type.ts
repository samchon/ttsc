// expect: prefer-function-type error
interface F {
  (x: number): string;
}
declare const f: F;
JSON.stringify(f);
