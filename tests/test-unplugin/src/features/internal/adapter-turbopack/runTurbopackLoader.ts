import loader from "../../../../../../packages/unplugin/src/turbopack";

/**
 * Invoke authored asynchronous completion without installing or starting a
 * host.
 */
export async function runTurbopackLoader(props: {
  resourcePath: string;
  source: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    loader.call(
      {
        resourcePath: props.resourcePath,
        async: () => (error, content) => {
          if (error !== undefined && error !== null) reject(error);
          else resolve(content ?? "");
        },
      },
      props.source,
    );
  });
}
