export interface NavItem {
  href: string;
  label: string;
  key: string;
}

export const nav: NavItem[] = [
  { href: "/", label: "Home", key: "home" },
  { href: "/play", label: "Play", key: "play" },
  { href: "/about", label: "About", key: "about" },
  { href: "/build-log", label: "Build Log", key: "build-log" },
  { href: "/source", label: "Source", key: "source" },
];
