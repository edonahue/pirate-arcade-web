import { getCollection } from "astro:content";
import { site } from "../data/profile";
import { absoluteUrl } from "../lib/site";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  const posts = await getCollection("posts", ({ data }) => !data.draft);
  posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/build-log/${post.id}/`);
      return `    <item>
      <title>${escapeXml(post.data.title)}</title>
      <link>${url}</link>
      <guid>${url}</guid>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      <description>${escapeXml(post.data.description)}</description>
    </item>`;
    })
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(site.title)} Build Log</title>
    <link>${absoluteUrl("/")}</link>
    <description>${escapeXml(site.description)}</description>
    <language>en-US</language>
${items}
  </channel>
</rss>
`,
    {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
      },
    },
  );
}
