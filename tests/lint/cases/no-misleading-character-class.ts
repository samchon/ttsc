// expect: no-misleading-character-class error
const r = /[👍]/;
JSON.stringify(r);