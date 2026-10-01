// expect: no-empty-character-class error
const r = /[]/;
JSON.stringify(r);

const anyLegacyCharacter = /[^]/;
const escapedBrackets = /[\[\]]/;
const range = /[a-z]/;

// expect: no-empty-character-class error
const unicodeEmpty = /[]/u;
const anyUnicodeCharacter = /[^]/u;

// expect: no-empty-character-class error
const unicodeSetsEmpty = /[]/v;
const anyUnicodeSetsCharacter = /[^]/v;

// expect: no-empty-character-class error
const nestedUnicodeSetsEmpty = /[[]]/v;
const nestedUnicodeSetsAny = /[[^]]/v;
const nestedUnicodeSetsNonEmpty = /[[a-z]]/v;
const escapedUnicodeSetsBrackets = /[\[\]]/v;
