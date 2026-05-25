// expect: preferFunctionType error
interface F {
  (x: number): string;
}
declare const f: F;
JSON.stringify(f);
