declare const reader: FileReader;
declare const blob: Blob;
// expect: unicorn/prefer-blob-reading-methods error
reader.readAsArrayBuffer(blob);
