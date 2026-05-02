// expect: no-new-wrappers error
const s = new String("a");
JSON.stringify(s);