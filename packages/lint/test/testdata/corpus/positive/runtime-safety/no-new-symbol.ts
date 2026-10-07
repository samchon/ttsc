// expect: no-new-symbol error
const bad = new Symbol("desc");
JSON.stringify(bad);
