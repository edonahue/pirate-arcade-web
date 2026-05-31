export interface PostMeta {
  slug: string;
  title: string;
  description: string;
  pubDate: Date;
  status: "post";
}

export const posts: PostMeta[] = [
  {
    slug: "the-pirate-arcade-experiment",
    title: "The Pirate Arcade Experiment",
    description:
      "How far can a zero-cost, AI-assisted development workflow go? This post covers the tools, constraints, and findings from building Pirate Arcade with free models, local hardware, and open source infrastructure.",
    pubDate: new Date("2026-05-31"),
    status: "post",
  },
];
