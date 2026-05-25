// expect: noOctalEscape error
const s: string = "\251";
JSON.stringify(s);