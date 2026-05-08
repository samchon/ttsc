/** Standalone `banner.config.*` file shape consumed by `@ttsc/banner`. */
export type TtscBannerConfig =
  | string
  | {
      /** Text inserted into the generated `@packageDocumentation` block. */
      text: string;
    };
