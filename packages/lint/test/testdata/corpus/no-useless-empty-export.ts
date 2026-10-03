export const marker = 1;

// expect: typescript/no-useless-empty-export error
export {};

JSON.stringify(marker);
