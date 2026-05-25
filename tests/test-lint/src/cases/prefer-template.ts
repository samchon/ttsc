const name = "world";
// expect: preferTemplate error
const s = "hi " + name + "!";
JSON.stringify(s);
