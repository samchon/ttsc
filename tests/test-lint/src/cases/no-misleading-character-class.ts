// expect: noMisleadingCharacterClass error
const r = /[👍]/;
JSON.stringify(r);
