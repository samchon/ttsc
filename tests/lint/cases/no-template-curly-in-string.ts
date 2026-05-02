// expect: no-template-curly-in-string error
const s: string = "hello ${name}";
JSON.stringify(s);
