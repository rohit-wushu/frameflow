// What the director may choose from, besides the template catalog.

import { LANGUAGE_INFO, SCRIPTS, type Language } from "@frameflow/scene-schema";

export interface Voice {
  id: string;
  engine: "kokoro" | "indic-parler";
  lang: Language; // the language it speaks (Hinglish is spoken by the Hindi voices)
  label: string;
  gender?: "female" | "male";
  rate?: number; // spoken words per second at speed 1.0, when measured; else the language's estimate
  tier: "free" | "pro"; // pro voices are a Pro customization: anyone can preview them, downloads need Pro
}

const kokoro = (id: string, lang: Language, label: string, gender: "female" | "male", rate?: number): Voice => ({ id, engine: "kokoro", lang, label, gender, rate, tier: "free" });
const parler = (lang: Language, speaker: string, gender: "female" | "male" | undefined, tier: "free" | "pro", note = ""): Voice => ({
  id: `pr_${lang}_${speaker.toLowerCase()}`,
  engine: "indic-parler",
  lang,
  label: `${["female", "male"].includes(speaker) ? `${LANGUAGE_INFO[lang].name} ${speaker} voice` : `${speaker}, ${LANGUAGE_INFO[lang].name}${gender ? `, ${gender}` : ""}`}${note}`,
  gender: gender ?? (speaker === "female" || speaker === "male" ? speaker : undefined),
  tier,
});

// Kokoro (fast, measured rates) for English and Hindi; Indic Parler-TTS (AI4Bharat) for every language, with the
// speakers its model card recommends. Each language keeps a free voice or two; the others are Pro voices.
// Speakers' genders come from the model card's names: check by listening before relying on them.
export const VOICES: Voice[] = [
  kokoro("af_heart", "en", "US English, female, warm and friendly (the default)", "female", 3.4),
  kokoro("af_bella", "en", "US English, female, bright and energetic", "female", 2.8),
  kokoro("af_nicole", "en", "US English, female, soft and calm (slow)", "female", 2.2),
  kokoro("am_michael", "en", "US English, male, calm and clear", "male", 2.6),
  kokoro("am_fenrir", "en", "US English, male, deep and confident", "male"),
  kokoro("am_puck", "en", "US English, male, upbeat and playful", "male", 3.5),
  kokoro("bf_emma", "en", "British English, female, polished", "female", 3.1),
  kokoro("bm_george", "en", "British English, male, authoritative", "male"),
  kokoro("hf_alpha", "hi", "Hindi, female, warm", "female", 2.6),
  kokoro("hf_beta", "hi", "Hindi, female, bright", "female"),
  kokoro("hm_omega", "hi", "Hindi, male, calm", "male", 2.6),
  kokoro("hm_psi", "hi", "Hindi, male, energetic", "male"),
  // Indic Parler-TTS: more natural, slower to make (premium)
  parler("en", "Mary", "female", "pro", ", Indian accent"),
  parler("en", "Thoma", "male", "pro", ", Indian accent"),
  parler("en", "Swapna", "female", "pro", ", Indian accent"),
  parler("en", "Dinesh", "male", "pro", ", Indian accent"),
  parler("hi", "Divya", "female", "pro"),
  parler("hi", "Rohit", "male", "pro"),
  parler("hi", "Rani", "female", "pro"),
  parler("hi", "Aman", "male", "pro"),
  parler("bn", "Aditi", "female", "free"),
  parler("bn", "Arjun", "male", "free"),
  parler("bn", "Rashmi", "female", "pro"),
  parler("bn", "Tapan", "male", "pro"),
  parler("mr", "Sunita", "female", "free"),
  parler("mr", "Sanjay", "male", "free"),
  parler("mr", "Radha", "female", "pro"),
  parler("mr", "Nikhil", "male", "pro"),
  parler("te", "Lalitha", "female", "free"),
  parler("te", "Prakash", "male", "free"),
  parler("te", "Kiran", "male", "pro"),
  parler("ta", "Jaya", "female", "free"),
  parler("ta", "male", undefined, "free"),
  parler("ta", "Kavitha", "female", "pro"),
  parler("gu", "Neha", "female", "free"),
  parler("gu", "Yash", "male", "free"),
  parler("kn", "Anu", "female", "free"),
  parler("kn", "Suresh", "male", "free"),
  parler("kn", "Vidya", "female", "pro"),
  parler("kn", "Chetan", "male", "pro"),
  parler("ml", "Anjali", "female", "free"),
  parler("ml", "Harish", "male", "free"),
  parler("ml", "Anju", "female", "pro"),
  parler("pa", "Gurpreet", undefined, "free"),
  parler("pa", "Divjot", undefined, "free"),
  parler("or", "Debjani", "female", "free"),
  parler("or", "Manas", "male", "free"),
  parler("as", "Sita", "female", "free"),
  parler("as", "Amit", "male", "free"),
  parler("ne", "Amrita", "female", "free"),
  parler("ne", "male", undefined, "free"),
  parler("sa", "Aryan", "male", "free"),
  parler("sa", "female", undefined, "free"),
  parler("brx", "Maya", "female", "free"),
  parler("brx", "Bikram", "male", "free"),
  parler("doi", "Karan", "male", "free"),
  parler("doi", "female", undefined, "free"),
  parler("mni", "Laishram", undefined, "free"),
  parler("mni", "Ranjit", undefined, "free"),
  ...(["ur", "mai", "kok", "sat", "sd"] as const).flatMap((l) => [parler(l, "female", undefined, "free"), parler(l, "male", undefined, "free")]),
];

// Which voices speak a plan's language (Hinglish is spoken by the Hindi voices).
export const voicesFor = (language: string, tier?: "free") =>
  VOICES.filter((v) => v.lang === (LANGUAGE_INFO[language as Language]?.voices ?? "en") && (!tier || v.tier === tier));

export const voiceRate = (v: Voice) => v.rate ?? LANGUAGE_INFO[v.lang].rate;

// What the director is told about the language. Every language but English is written in its own script.
export function languageNote(language: string): string {
  const info = LANGUAGE_INFO[language as Language] ?? LANGUAGE_INFO.en;
  if (language === "en") return "English.";
  if (language === "hinglish")
    return "Hinglish: everyday Hindi mixed with the English words people in India really use (app, video, launch, free). Write everything in Devanagari, English words included (ऐप, वीडियो, लॉन्च, फ्री), so the Hindi voice reads it naturally. Write numbers as digits.";
  return `${info.name} (${info.native}). Write every voiceover and all on-screen text in natural, everyday spoken ${info.name}, in ${SCRIPTS[info.script].name} script. Write numbers as digits.`;
}

export const DEFAULT_RATE = 2.6;
export const PAUSE_SECONDS = 0.27; // per comma/period inside a voiceover (fitted with the rates)

export const TRANSITION_NOTES = {
  cut: "hard cut with a small punch-in; energetic",
  fade: "cross-fade; calm, premium",
  slide: "the next scene slides in from the right; lists and sequences",
  zoom: "zoom through; bold moments",
  wipe: "a brand-color panel wipes across; section breaks",
};

