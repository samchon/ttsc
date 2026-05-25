// expect: noScriptUrl error
const u: string = "javascript:alert(1)";
JSON.stringify(u);
