const name = "world";
// expect: prefer-template error
const s = "hi " + name + "!";
JSON.stringify(s);
