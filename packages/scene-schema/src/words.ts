// One word-normalization rule shared by validation, timing, SFX and templates,
// so "Beat," in a voiceover and "beat" in a cue or a card title always match.
// Letters, digits and combining marks are kept: vowel signs and the virama of Indian scripts are marks (\p{M}),
// and dropping them would make different words look the same.
export function normalizeWord(word: string): string {
  return word.toLowerCase().normalize("NFC").replace(/[^\p{L}\p{M}\p{N}']/gu, "");
}

export function voiceWords(text: string): string[] {
  return text.split(/\s+/).map(normalizeWord).filter(Boolean);
}

// How many words an integer is read as ("one hundred", "twenty eight", "nineteen ninety eight").
function numberWords(n: number, asYear: boolean): number {
  if (asYear && n >= 1100 && n <= 2099 && n % 1000 >= 100) {
    const hi = Math.floor(n / 100), lo = n % 100; // 1998 -> nineteen / ninety eight
    return (hi % 10 === 0 || hi < 20 ? 1 : 2) + (lo === 0 ? 1 : lo < 20 || lo % 10 === 0 ? 1 : 2);
  }
  if (n < 20) return 1;
  if (n < 100) return n % 10 === 0 ? 1 : 2;
  const scales: [number, number][] = [[1e9, 1], [1e6, 1], [1e3, 1], [100, 1]];
  for (const [unit, name] of scales) {
    if (n >= unit) {
      const head = Math.floor(n / unit), rest = n % unit;
      return numberWords(head, false) + name + (rest ? numberWords(rest, false) : 0);
    }
  }
  return 1;
}

// How many words a written token is spoken as: numbers and symbols are read out
// ("41.8k" -> forty one point eight thousand = 5, "$30" -> thirty dollars = 2).
export function spokenWordCount(token: string): number {
  const core = token.replace(/^[^\p{L}\p{M}\p{N}$&+@=]+|[^\p{L}\p{M}\p{N}%]+$/gu, "");
  if (!core) return 0;
  if (/^[&+@=]$/.test(core)) return 1;
  const m = /^(\$)?(\d[\d,]*)(?:\.(\d+))?(%|[kKmMbBxX])?$/.exec(core);
  if (!m) return 1;
  const [, dollar, whole, decimals, suffix] = m;
  const n = Number(whole.replace(/,/g, ""));
  let count = numberWords(n, !whole.includes(",") && !decimals && !dollar && !suffix);
  if (decimals) count += 1 + decimals.length; // "point" + each digit
  if (suffix) count += 1;
  if (dollar) count += 1;
  return count;
}

export interface SpeechModel {
  rates: Record<string, number>; // spoken words per second, per voice id, at speed 1.0
  defaultRate: number; // for voices without a measured rate
  pause: number; // seconds added per comma/period inside the line
  overhead: number; // seconds each scene adds around its voice (lead-in + tail)
}

// Estimated seconds of speech for a voiceover (without the scene overhead).
export function speechSeconds(text: string, voiceId: string, speed: number, model: SpeechModel): number {
  const words = text.split(/\s+/).filter(Boolean);
  const spoken = words.reduce((sum, w) => sum + spokenWordCount(w), 0);
  const pauses = words.slice(0, -1).filter((w) => /[.,!?;:\u0964\u0965\u06d4\u060c\u1c7e\u1c7f]$/.test(w)).length; // incl. the danda, Urdu and Ol Chiki stops
  const rate = (model.rates[voiceId] ?? model.defaultRate) * (speed || 1);
  return spoken / rate + pauses * model.pause;
}
