export interface PublicDomainArt {
  id: string;
  title: string;
  alt: string;
  filename: string;
  width: number;
  height: number;
  format: string;
  sourceUrl: string;
  sourcePage: string;
  license: string;
  author: string;
  year: number;
  collection: string;
  usage: "informative" | "decorative";
}

export const publicDomainArt: PublicDomainArt[] = [
  {
    id: "pyle-marooned",
    title: "Marooned",
    alt: "Illustration of a marooned pirate alone on a beach, from Howard Pyle's Book of Pirates",
    filename: "pyle-marooned.webp",
    width: 1600,
    height: 1128,
    format: "image/webp",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/1/1a/Howard_Pyle%27s_Book_of_Pirates_%281921%29%2C_p._25.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Howard_Pyle%27s_Book_of_Pirates_(1921),_p._25.jpg",
    license: "Public domain (author died 1911, published 1921, pre-1931 US)",
    author: "Howard Pyle",
    year: 1921,
    collection: "Howard Pyle's Book of Pirates",
    usage: "decorative",
  },
  {
    id: "pyle-blackbeard-buries-treasure",
    title: "Blackbeard Buries His Treasure",
    alt: "Illustration of Blackbeard burying treasure on a moonlit beach, from Howard Pyle's Book of Pirates",
    filename: "pyle-blackbeard-buries-treasure.webp",
    width: 1600,
    height: 1120,
    format: "image/webp",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/e/e4/Howard_Pyle%27s_Book_of_Pirates_%281921%29%2C_p._31.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Howard_Pyle%27s_Book_of_Pirates_(1921),_p._31.jpg",
    license: "Public domain (author died 1911, published 1921, pre-1931 US)",
    author: "Howard Pyle",
    year: 1921,
    collection: "Howard Pyle's Book of Pirates",
    usage: "decorative",
  },
  {
    id: "pyle-walking-the-plank",
    title: "Walking the Plank",
    alt: "Illustration of pirates forcing a captive to walk the plank, from Howard Pyle's Book of Pirates",
    filename: "pyle-walking-the-plank.webp",
    width: 1600,
    height: 1125,
    format: "image/webp",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/d/da/Howard_Pyle%27s_Book_of_Pirates_%281921%29%2C_p._37.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Howard_Pyle%27s_Book_of_Pirates_(1921),_p._37.jpg",
    license: "Public domain (author died 1911, published 1921, pre-1931 US)",
    author: "Howard Pyle",
    year: 1921,
    collection: "Howard Pyle's Book of Pirates",
    usage: "decorative",
  },
  {
    id: "rhead-treasure-island-cover",
    title: "Treasure Island — Cover Illustration",
    alt: "Treasure Island cover illustration by Louis Rhead, depicting the treasure map with the Hispaniola at sea",
    filename: "rhead-treasure-island-cover.webp",
    width: 1000,
    height: 1491,
    format: "image/webp",
    sourceUrl: "https://www.gutenberg.org/files/120/120-h/images/cover.jpg",
    sourcePage: "https://www.gutenberg.org/ebooks/120",
    license: "Public domain (published 1915, author died 1926)",
    author: "Louis Rhead",
    year: 1915,
    collection: "Treasure Island (Louis Rhead illustrated edition)",
    usage: "informative",
  },
  {
    id: "pyle-treasure-division",
    title: "So the Treasure Was Divided",
    alt: "Illustration of pirates dividing treasure on a beach, from Howard Pyle's Book of Pirates",
    filename: "pyle-treasure-division.webp",
    width: 1600,
    height: 979,
    format: "image/webp",
    sourceUrl:
      "https://upload.wikimedia.org/wikipedia/commons/2/27/Howard_Pyle%27s_Book_of_Pirates_%281921%29%2C_p._245.jpg",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Howard_Pyle%27s_Book_of_Pirates_(1921),_p._245.jpg",
    license: "Public domain (author died 1911, published 1921, pre-1931 US)",
    author: "Howard Pyle",
    year: 1921,
    collection: "Howard Pyle's Book of Pirates",
    usage: "decorative",
  },
];
