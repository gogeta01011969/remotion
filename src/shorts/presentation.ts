import {z} from 'zod';

export const presentationSchema = z.enum(['silent', 'narrated']);
export type Presentation = z.infer<typeof presentationSchema>;
export const readingFrames = (text: string, fps: number) => Math.ceil(Math.max(1.6, .6 + text.trim().split(/\s+/).length / 2.8) * fps);
