// expect: typescript/consistent-generic-constructors error
const m: Map<string, number> = new Map<string, number>();
JSON.stringify(m);
