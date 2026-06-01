import { site } from "../data/profile";

export const profileLinks = [
  "https://erichdonahue.com/",
  "https://erichdonahue.com/projects/pirate-arcade/",
  "https://github.com/edonahue/pirate-arcade",
  "https://github.com/edonahue/pirate-arcade-web",
  "https://www.linkedin.com/in/erichdonahue/",
  "https://x.com/erichdonahue",
  "https://buymeacoffee.com/erichdonahue",
] as const;

export function absoluteUrl(pathOrUrl: string, base = site.url): string {
  return new URL(pathOrUrl, base).href;
}

export function canonicalPath(pathname: string): string {
  const path = pathname.split("?")[0].split("#")[0] || "/";
  if (path === "/") return "/";
  return path.endsWith("/") ? path : `${path}/`;
}
