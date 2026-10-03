declare function fileURLToPath(url: string): string;
// expect: unicorn/prefer-import-meta-properties error
const filename = fileURLToPath(import.meta.url);
void filename;
