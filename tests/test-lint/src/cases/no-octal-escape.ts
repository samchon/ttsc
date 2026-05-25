// expect: no-octal-escape error
const s: string = "\251";
JSON.stringify(s);