// A word as returned by /align: seconds from the start of that scene's voice file.
export interface AlignedWord {
  word: string;
  start: number;
  end: number;
}

export interface SceneVoice {
  duration: number;
  words: AlignedWord[];
}

// Beat grid in video time (the music is trimmed so that t = 0 is a downbeat).
export interface BeatGrid {
  bpm: number;
  beats: number[];
  downbeats: number[];
}

// The parts of a template's meta that timing needs.
export interface TemplateTiming {
  minDuration: number;
  maxDuration: number;
  listField?: string; // content field whose items appear one by one
  accentAt?: number; // seconds after the scene start where the template's big hit lands
}

// A spoken word in video time. `w` is normalized for lookups, `text` is as written.
export interface TimedWord {
  w: string;
  text: string;
  s: number;
  e: number;
}

export interface SceneTiming {
  id: string;
  template: string;
  start: number;
  duration: number;
  end: number;
  voiceStart: number | null;
  voiceEnd: number | null;
  words: TimedWord[];
  items: number[]; // reveal time of each list item
  accent: number | null;
  cutOut: { natural: number; beat: number | null } | null; // null for the last scene
}

export interface TimingResult {
  duration: number;
  fps: number;
  bpm: number | null;
  beats: number[];
  downbeats: number[];
  scenes: SceneTiming[];
  warnings: string[];
}
