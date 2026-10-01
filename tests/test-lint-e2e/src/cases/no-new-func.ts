// expect: no-new-func error
const f = new Function("a", "return a");
JSON.stringify(f);
