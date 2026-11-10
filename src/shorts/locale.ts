import {z} from 'zod';
export const languageSchema = z.enum(['en', 'hi', 'hinglish']);
export type Language = z.infer<typeof languageSchema>;
export const voiceFor = (language: Language) => language !== 'en' ? 'Lekha' : 'Daniel';
export const speechText = (text: string, language: Language) => language !== 'en' ? text.replace(/ॐ/g, 'ओम') : text;
export function namesSound(text: string, sound: 'A' | 'U' | 'M') {
  const aliases = {A: ['A', 'अ', 'आ'], U: ['U', 'उ', 'ऊ'], M: ['M', 'म', 'म्']}[sound];
  return aliases.some(alias => new RegExp(`(?<![\\p{L}\\p{M}])${alias}(?![\\p{L}\\p{M}])`, 'u').test(text));
}
export const symbolCopy = {
  en: {header: 'ANCIENT WISDOM /', footer: 'ANCIENT WISDOM · SCRIPTURAL INTERPRETATION', states: 'SOUNDS AND STATES · A SYMBOLIC TEACHING', sound: 'SOUND · ATTENTION · MEANING', reflect: 'What remains?', silence: 'Beyond the sound', teaching: 'A TEACHING ON SOUND AND THE SELF', sounds: {A: 'A', U: 'U', M: 'M'}},
  hinglish: {header: 'ANCIENT WISDOM /', footer: 'ANCIENT WISDOM · A TRADITIONAL TEACHING', states: 'SOUNDS AND STATES · A SYMBOLIC TEACHING', sound: 'SOUND · ATTENTION · MEANING', reflect: 'Sound ke baad?', silence: 'Sound se aage', teaching: 'SOUND, EXPERIENCE AND THE SELF', sounds: {A: 'A', U: 'U', M: 'M'}},
  hi: {header: 'प्राचीन ज्ञान /', footer: 'प्राचीन ज्ञान · शास्त्रीय व्याख्या', states: 'ध्वनियाँ और अवस्थाएँ · एक प्रतीकात्मक शिक्षा', sound: 'ध्वनि · ध्यान · अर्थ', reflect: 'क्या शेष रह जाता है?', silence: 'ध्वनि के पार', teaching: 'ध्वनि और आत्मा की एक शिक्षा', sounds: {A: 'अ', U: 'उ', M: 'म्'}},
} as const;
