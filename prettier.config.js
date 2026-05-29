module.exports = {
  // DEFAULT CONFIGURATIONS
  printWidth: 80,
  semi: true,
  tabWidth: 2,
  trailingComma: "all",

  // PLUG-IN CONFIGURATIONS
  plugins: [
    require.resolve("@trivago/prettier-plugin-sort-imports"),
    require.resolve("prettier-plugin-jsdoc"),
  ],
  importOrder: ["<THIRD_PARTY_MODULES>", "@api(.*)$", "^[./]"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  importOrderParserPlugins: ["decorators-legacy", "typescript", "jsx"],

  overrides: [
    // TypeScript: force the typescript parser (matches the previous top-level
    // `parser: "typescript"` so `.ts`/`.tsx`/`.mts`/`.cts` keep formatting).
    {
      files: ["*.ts", "*.tsx", "*.mts", "*.cts"],
      options: { parser: "typescript" },
    },
    // Markdown / MDX: Markdown soft-wraps on render, so manual mid-paragraph
    // line breaks change nothing visible and only make diffs noisy. Keep prose
    // on a single line. `embeddedLanguageFormatting: "off"` keeps fenced code
    // blocks byte-identical (Prettier must not reformat ```ts etc.).
    {
      files: ["*.md", "*.mdx"],
      options: {
        proseWrap: "never",
        embeddedLanguageFormatting: "off",
      },
    },
  ],
};
