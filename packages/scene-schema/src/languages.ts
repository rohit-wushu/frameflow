// The languages a video can be in. English and Hindi have fast Kokoro voices; every language has Indic
// Parler-TTS voices (AI4Bharat). `rate` is a first estimate of spoken words per second for voices that
// haven't been measured (languages with long compound words, like Tamil or Malayalam, say fewer words a second).
// `beta`: the voice model supports the language less well, or its script is rare in fonts; check the output.

export type Script = "latin" | "devanagari" | "bengali" | "tamil" | "telugu" | "gujarati" | "kannada" | "malayalam" | "gurmukhi" | "oriya" | "arabic" | "olchiki";

// Per script: the Google Fonts family that fills in glyphs brand fonts lack, and its Google Fonts subset.
export const SCRIPTS: Record<Script, { name: string; font: string | null; subset: string; dir: "ltr" | "rtl" }> = {
  latin: { name: "Latin", font: null, subset: "latin", dir: "ltr" },
  devanagari: { name: "Devanagari", font: "Noto Sans Devanagari", subset: "devanagari", dir: "ltr" },
  bengali: { name: "Bengali", font: "Noto Sans Bengali", subset: "bengali", dir: "ltr" },
  tamil: { name: "Tamil", font: "Noto Sans Tamil", subset: "tamil", dir: "ltr" },
  telugu: { name: "Telugu", font: "Noto Sans Telugu", subset: "telugu", dir: "ltr" },
  gujarati: { name: "Gujarati", font: "Noto Sans Gujarati", subset: "gujarati", dir: "ltr" },
  kannada: { name: "Kannada", font: "Noto Sans Kannada", subset: "kannada", dir: "ltr" },
  malayalam: { name: "Malayalam", font: "Noto Sans Malayalam", subset: "malayalam", dir: "ltr" },
  gurmukhi: { name: "Gurmukhi", font: "Noto Sans Gurmukhi", subset: "gurmukhi", dir: "ltr" },
  oriya: { name: "Odia", font: "Noto Sans Oriya", subset: "oriya", dir: "ltr" },
  arabic: { name: "Perso-Arabic", font: "Noto Naskh Arabic", subset: "arabic", dir: "rtl" },
  olchiki: { name: "Ol Chiki", font: "Noto Sans Ol Chiki", subset: "ol-chiki", dir: "ltr" },
};

export const LANGUAGES = [
  "en", "hi", "hinglish", "bn", "mr", "te", "ta", "gu", "kn", "ml", "pa", "or", "as", "ur", "ne", "sa", "mai", "kok", "doi", "brx", "mni", "sat", "sd",
] as const;
export type Language = (typeof LANGUAGES)[number];

export interface LanguageInfo {
  name: string; // in English
  native: string; // in its own script
  script: Script;
  rate: number;
  voices: Language; // whose voices speak it (Hinglish is spoken by the Hindi voices)
  sample: string; // what a voice preview says (beta languages: just a greeting)
  beta?: boolean;
}

export const LANGUAGE_INFO: Record<Language, LanguageInfo> = {
  en: { name: "English", native: "English", script: "latin", rate: 2.8, voices: "en", sample: "Hi! This is how I will sound in your video." },
  hi: { name: "Hindi", native: "हिन्दी", script: "devanagari", rate: 2.6, voices: "hi", sample: "नमस्ते! आपके वीडियो में मेरी आवाज़ ऐसी सुनाई देगी।" },
  hinglish: { name: "Hinglish", native: "हिंग्लिश", script: "devanagari", rate: 2.6, voices: "hi", sample: "हाय! आपके वीडियो में मेरी वॉइस ऐसी लगेगी।" },
  bn: { name: "Bengali", native: "বাংলা", script: "bengali", rate: 2.3, voices: "bn", sample: "নমস্কার! আপনার ভিডিওতে আমার কণ্ঠ এমন শোনাবে।" },
  mr: { name: "Marathi", native: "मराठी", script: "devanagari", rate: 2.3, voices: "mr", sample: "नमस्कार! तुमच्या व्हिडिओमध्ये माझा आवाज असा ऐकू येईल." },
  te: { name: "Telugu", native: "తెలుగు", script: "telugu", rate: 2.0, voices: "te", sample: "నమస్కారం! మీ వీడియోలో నా గొంతు ఇలా వినిపిస్తుంది." },
  ta: { name: "Tamil", native: "தமிழ்", script: "tamil", rate: 1.8, voices: "ta", sample: "வணக்கம்! உங்கள் வீடியோவில் என் குரல் இப்படித்தான் ஒலிக்கும்." },
  gu: { name: "Gujarati", native: "ગુજરાતી", script: "gujarati", rate: 2.4, voices: "gu", sample: "નમસ્તે! તમારા વીડિયોમાં મારો અવાજ આવો સંભળાશે." },
  kn: { name: "Kannada", native: "ಕನ್ನಡ", script: "kannada", rate: 1.9, voices: "kn", sample: "ನಮಸ್ಕಾರ! ನಿಮ್ಮ ವಿಡಿಯೋದಲ್ಲಿ ನನ್ನ ಧ್ವನಿ ಹೀಗೆ ಕೇಳಿಸುತ್ತದೆ." },
  ml: { name: "Malayalam", native: "മലയാളം", script: "malayalam", rate: 1.7, voices: "ml", sample: "നമസ്കാരം! നിങ്ങളുടെ വീഡിയോയിൽ എന്റെ ശബ്ദം ഇങ്ങനെയായിരിക്കും." },
  pa: { name: "Punjabi", native: "ਪੰਜਾਬੀ", script: "gurmukhi", rate: 2.6, voices: "pa", sample: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਤੁਹਾਡੀ ਵੀਡੀਓ ਵਿੱਚ ਮੇਰੀ ਆਵਾਜ਼ ਇਸ ਤਰ੍ਹਾਂ ਸੁਣਾਈ ਦੇਵੇਗੀ।" },
  or: { name: "Odia", native: "ଓଡ଼ିଆ", script: "oriya", rate: 2.2, voices: "or", sample: "ନମସ୍କାର! ଆପଣଙ୍କ ଭିଡିଓରେ ମୋ ସ୍ୱର ଏମିତି ଶୁଣାଯିବ।" },
  as: { name: "Assamese", native: "অসমীয়া", script: "bengali", rate: 2.2, voices: "as", sample: "নমস্কাৰ! আপোনাৰ ভিডিঅ'ত মোৰ মাত এনেকুৱা শুনা যাব।" },
  ur: { name: "Urdu", native: "اردو", script: "arabic", rate: 2.6, voices: "ur", sample: "السلام علیکم! آپ کی ویڈیو میں میری آواز ایسی سنائی دے گی۔" },
  ne: { name: "Nepali", native: "नेपाली", script: "devanagari", rate: 2.4, voices: "ne", sample: "नमस्ते! तपाईंको भिडियोमा मेरो आवाज यस्तो सुनिनेछ।" },
  sa: { name: "Sanskrit", native: "संस्कृतम्", script: "devanagari", rate: 2.0, voices: "sa", sample: "नमस्कारः! भवतः चलचित्रे मम स्वरः एवं श्रूयते।" },
  mai: { name: "Maithili", native: "मैथिली", script: "devanagari", rate: 2.4, voices: "mai", sample: "प्रणाम! अहाँक वीडियो मे हमर आवाज एहन सुनाइ देत।", beta: true },
  kok: { name: "Konkani", native: "कोंकणी", script: "devanagari", rate: 2.3, voices: "kok", sample: "नमस्कार! तुमच्या व्हिडियोंत म्हजो आवाज असो आयकूंक मेळटलो.", beta: true },
  doi: { name: "Dogri", native: "डोगरी", script: "devanagari", rate: 2.4, voices: "doi", sample: "नमस्कार! एह् मेरी आवाज़ ऐ।", beta: true },
  brx: { name: "Bodo", native: "बड़ो", script: "devanagari", rate: 2.3, voices: "brx", sample: "खुलुमबाय!", beta: true },
  mni: { name: "Manipuri", native: "মৈতৈলোন্", script: "bengali", rate: 2.2, voices: "mni", sample: "খুরুমজরি!", beta: true },
  sat: { name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ", script: "olchiki", rate: 2.2, voices: "sat", sample: "ᱡᱚᱦᱟᱨ!", beta: true },
  sd: { name: "Sindhi", native: "سنڌي", script: "arabic", rate: 2.5, voices: "sd", sample: "سلام! هي منهنجو آواز آهي۔", beta: true },
};

export const scriptOf = (language: string): Script => LANGUAGE_INFO[language as Language]?.script ?? "latin";
// <html lang> for the rendered video (Hinglish is written in Devanagari like Hindi)
export const htmlLang = (language: string) => (language === "hinglish" ? "hi" : language);
