export type Item = { title: string; url?: string; source: string; tag?: string; meta?: string; image?: string; summary?: string; date?: string; label?: string };
export type Feed = { items: Item[]; error?: string; sources?: string[] };
