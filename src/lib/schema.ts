import type { Game } from "../data/games";
import { site } from "../data/profile";
import { absoluteUrl, profileLinks } from "./site";

export type JsonLdNode = Record<string, unknown>;

export function personNode(): JsonLdNode {
  return {
    "@type": "Person",
    "@id": `${absoluteUrl("/")}#erich`,
    name: site.author,
    url: site.authorUrl,
    sameAs: profileLinks,
  };
}

export function websiteNode(description = site.description): JsonLdNode {
  return {
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    url: absoluteUrl("/"),
    name: site.title,
    description,
    publisher: { "@id": `${absoluteUrl("/")}#erich` },
    inLanguage: "en-US",
  };
}

export function webPageNode(
  url: string,
  name: string,
  description: string,
  type = "WebPage",
): JsonLdNode {
  return {
    "@type": type,
    "@id": `${absoluteUrl(url)}#webpage`,
    url: absoluteUrl(url),
    name,
    description,
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    about: { "@id": `${absoluteUrl("/")}#project` },
    inLanguage: "en-US",
  };
}

export function projectNode(): JsonLdNode {
  return {
    "@type": ["SoftwareApplication", "VideoGame"],
    "@id": `${absoluteUrl("/")}#project`,
    name: site.title,
    description: site.description,
    url: absoluteUrl("/"),
    author: { "@id": `${absoluteUrl("/")}#erich` },
    creator: { "@id": `${absoluteUrl("/")}#erich` },
    codeRepository: [
      "https://github.com/edonahue/pirate-arcade",
      "https://github.com/edonahue/pirate-arcade-web",
    ],
    sameAs: profileLinks,
    applicationCategory: "GameApplication",
    operatingSystem: ["Windows", "Linux", "macOS", "Web browser"],
    image: absoluteUrl("/og-image.png"),
    keywords: [
      "Python",
      "Pygame",
      "Pygbag",
      "WebAssembly",
      "Phaser",
      "Web-native games",
      "Browser games",
      "Astro",
      "Cloudflare Pages",
      "AI-assisted development",
      "Pirate games",
    ],
  };
}

export function gameNode(game: Game): JsonLdNode {
  let gamePlatform: string[];
  if (game.engine === "phaser") {
    gamePlatform = ["Web browser"];
  } else if (game.status === "browser-playable") {
    gamePlatform = ["Web browser", "Windows", "Linux"];
  } else {
    gamePlatform = ["Windows", "Linux", "macOS"];
  }
  return {
    "@type": "VideoGame",
    "@id": `${absoluteUrl(`/games/${game.id}/`)}#game`,
    name: game.title,
    description: game.description,
    url: absoluteUrl(`/games/${game.id}/`),
    image: game.screenshot ? absoluteUrl(game.screenshot) : undefined,
    gamePlatform,
    applicationCategory: "GameApplication",
    genre: "Arcade",
    isPartOf: { "@id": `${absoluteUrl("/")}#project` },
    author: { "@id": `${absoluteUrl("/")}#erich` },
  };
}

export function breadcrumbNode(
  items: { name: string; url: string }[],
): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.url),
    })),
  };
}

export function jsonLdGraph(nodes: JsonLdNode[]): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.filter(Boolean),
  };
}
