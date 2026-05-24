import { useMDXComponents as getDocsMDXComponents } from "nextra-theme-docs";

const docsComponents = getDocsMDXComponents();

function formatDate(value) {
  const date = value ? new Date(value) : null;
  return Number.isNaN(date?.getTime?.()) ? null : date;
}

function groupHeadings(toc) {
  const headings = Array.isArray(toc)
    ? toc.filter((item) => Number(item.depth) <= 3)
    : [];
  const groups = [];
  let currentGroup = null;
  for (const item of headings) {
    if (Number(item.depth) <= 2) {
      currentGroup = {
        ...item,
        children: [],
      };
      groups.push(currentGroup);
      continue;
    }
    if (currentGroup) currentGroup.children.push(item);
    else {
      groups.push({
        ...item,
        children: [],
      });
    }
  }
  return groups;
}

export function useMDXComponents(components) {
  return {
    ...docsComponents,
    ...components,
    wrapper({ children, metadata, toc }) {
      const date = formatDate(metadata?.date);
      const tags = metadata?.tags ?? [];
      const groups = groupHeadings(toc);
      const hasToc = groups.length > 0;

      return (
        <div
          className={
            hasToc
              ? "ttsc-blog-post-page ttsc-blog-post-layout"
              : "ttsc-blog-post-page"
          }
        >
          <div className="ttsc-blog-post-main">
            {metadata?.ogImage ? (
              <img
                src={metadata.ogImage}
                alt={metadata.title ?? "Blog cover image"}
                className="ttsc-blog-hero"
              />
            ) : null}
            <h1>{metadata?.title}</h1>
            <div className="ttsc-blog-meta">
              {date ? (
                <time dateTime={date.toISOString()}>
                  {date.toLocaleDateString()}
                </time>
              ) : null}
              {metadata?.author ? <span>{metadata.author}</span> : null}
              {metadata?.devtoUrl ? (
                <a href={metadata.devtoUrl} target="_blank" rel="noreferrer">
                  Original on DEV
                </a>
              ) : null}
            </div>
            {tags.length ? (
              <div className="ttsc-blog-tags">
                {tags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </div>
            ) : null}
            {children}
          </div>
          {hasToc ? (
            <aside className="ttsc-blog-toc" aria-label="Table of contents">
              <div className="ttsc-blog-toc-inner">
                <div className="ttsc-blog-toc-title">On This Page</div>
                <nav aria-label="Table of contents">
                  <ul className="ttsc-blog-toc-list">
                    {groups.map((item) => (
                      <li key={item.id} className="ttsc-blog-toc-item">
                        <a
                          href={`#${item.id}`}
                          className={`ttsc-blog-toc-link ttsc-blog-toc-depth-${item.depth}`}
                        >
                          {item.value}
                        </a>
                        {item.children.length ? (
                          <ul className="ttsc-blog-toc-sublist">
                            {item.children.map((child) => (
                              <li
                                key={child.id}
                                className="ttsc-blog-toc-subitem"
                              >
                                <a
                                  href={`#${child.id}`}
                                  className={`ttsc-blog-toc-link ttsc-blog-toc-depth-${child.depth}`}
                                >
                                  {child.value}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            </aside>
          ) : null}
        </div>
      );
    },
  };
}
