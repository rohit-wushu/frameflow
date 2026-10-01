// What the director may choose from, besides the template catalog.

// rate = spoken words per second at speed 1.0, measured from Kokoro output (numbers count as the words
// they are read as). Voices without a measurement use DEFAULT_RATE.
export const VOICES = [
  { id: "af_heart", lang: "en", label: "US English, female, warm and friendly (the default)", rate: 3.4 },
  { id: "af_bella", lang: "en", label: "US English, female, bright and energetic", rate: 2.8 },
  { id: "af_nicole", lang: "en", label: "US English, female, soft and calm (slow)", rate: 2.2 },
  { id: "am_michael", lang: "en", label: "US English, male, calm and clear", rate: 2.6 },
  { id: "am_fenrir", lang: "en", label: "US English, male, deep and confident", rate: undefined },
  { id: "am_puck", lang: "en", label: "US English, male, upbeat and playful", rate: 3.5 },
  { id: "bf_emma", lang: "en", label: "British English, female, polished", rate: 3.1 },
  { id: "bm_george", lang: "en", label: "British English, male, authoritative", rate: undefined },
  // Hindi (Kokoro's Hindi voices; see CLAUDE.md "Hindi" for the Indic Parler-TTS question)
  { id: "hf_alpha", lang: "hi", label: "Hindi, female, warm", rate: 2.6 },
  { id: "hf_beta", lang: "hi", label: "Hindi, female, bright", rate: undefined },
  { id: "hm_omega", lang: "hi", label: "Hindi, male, calm", rate: 2.6 },
  { id: "hm_psi", lang: "hi", label: "Hindi, male, energetic", rate: undefined },
] as const;

// Which voices fit a plan's language (Hinglish is spoken by the Hindi voices).
export const voicesFor = (language: string) => VOICES.filter((v) => v.lang === (language === "en" ? "en" : "hi"));

export const LANGUAGE_NOTES: Record<string, string> = {
  en: "English.",
  hi: "Hindi. Write every voiceover and all on-screen text in natural spoken Hindi, in Devanagari script. Write numbers as digits.",
  hinglish:
    "Hinglish: everyday Hindi mixed with the English words people in India really use (app, video, launch, free). Write everything in Devanagari, English words included (ऐप, वीडियो, लॉन्च, फ्री), so the Hindi voice reads it naturally. Write numbers as digits.",
};
export const DEFAULT_RATE = 2.6;
export const PAUSE_SECONDS = 0.27; // per comma/period inside a voiceover (fitted with the rates)

export const TRANSITION_NOTES = {
  cut: "hard cut with a small punch-in; energetic",
  fade: "cross-fade; calm, premium",
  slide: "the next scene slides in from the right; lists and sequences",
  zoom: "zoom through; bold moments",
  wipe: "a brand-color panel wipes across; section breaks",
};

