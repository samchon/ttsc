// expect: noTemplateCurlyInString error
const s: string = "hello ${name}";
JSON.stringify(s);
