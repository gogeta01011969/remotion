import {z} from 'zod';

export const genreSchema = z.enum(['what-if', 'mythology', 'explainer']);
export type Genre = z.infer<typeof genreSchema>;
// Conservative routing with an explicit CLI override for ambiguous topics.
export function detectGenre(topic: string): Genre {
  if (/^\s*what\s+if\b/i.test(topic)) return 'what-if';
  if (/\b(om|aum|sacred|shiva|vishnu|ganesha|krishna|hanuman|lakshmi|saraswati|chandra|mythology|myth|ancient wisdom|purana|ramayana|mahabharata|zeus|athena|odin|thor|buddha|tao)\b/i.test(topic)) return 'mythology';
  return 'explainer';
}
export const presentations = {
  'what-if': {label: 'WHAT IF /', footer: 'ILLUSTRATED THOUGHT EXPERIMENT', accent: '#73E7FF', background: '#030A13', glow: '#102A3C', tags: '#WhatIf #Science #Shorts'},
  mythology: {label: 'ANCIENT WISDOM /', footer: 'MYTHOLOGY · TRADITIONAL ACCOUNTS VARY', accent: '#EBC98A', background: '#0C0C19', glow: '#24213D', tags: '#AncientWisdom #Mythology #Shorts'},
  explainer: {label: 'A CLOSER LOOK /', footer: 'ILLUSTRATED EXPLAINER', accent: '#73E7FF', background: '#030A13', glow: '#102A3C', tags: '#Explained #Shorts'},
} as const;
