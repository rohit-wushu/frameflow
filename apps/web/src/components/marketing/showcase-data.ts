// Generated from the showcase renders in storage/projects/showcase-*/v1 (plan, timing.json, qa.json).
// Media lives in public/marketing/{showcase,tpl}. Example brands, rendered by the Frameflow engine.

export type ShowcaseScene = { id: string; template: string; label: string; start: number; end: number; clipPoster: string; clip?: string };
export type Showcase = {
  brand: string;
  title: string;
  format: "16:9" | "9:16" | "1:1";
  language: "en" | "hi" | "hinglish"; // the voiceover's language
  duration: number;
  src: string;
  poster: string;
  colors: string[];
  background: string;
  font: string;
  voice: string;
  music: { track: string; bpm: number }; // track = the title in credits.txt, by Kevin MacLeod, CC BY 4.0
  loudness: number;
  cuts: number;
  cutsOnBeat: number;
  scenes: ShowcaseScene[];
  beats: number[];
  downbeats: number[];
};

export const SHOWCASE = {
  "ledgerly": {
    "brand": "Ledgerly",
    "title": "Ledgerly launch",
    "format": "16:9",
    "language": "en",
    "duration": 26.08,
    "src": "/marketing/showcase/ledgerly.mp4",
    "poster": "/marketing/showcase/ledgerly.jpg",
    "colors": [
      "#10B981",
      "#0EA5E9",
      "#F6F8F5",
      "#0B1F17"
    ],
    "background": "#F6F8F5",
    "font": "Plus Jakarta Sans",
    "voice": "Michael (US)",
    "music": {
      "track": "Inspired",
      "bpm": 120.19
    },
    "loudness": -14.1,
    "cuts": 6,
    "cutsOnBeat": 6,
    "scenes": [
      {
        "id": "hook",
        "template": "kinetic_words",
        "label": "Kinetic words",
        "start": 0,
        "end": 2,
        "clipPoster": "/marketing/tpl/ledgerly-hook.jpg"
      },
      {
        "id": "problem",
        "template": "problem_list",
        "label": "Problem list",
        "start": 2,
        "end": 6.01,
        "clipPoster": "/marketing/tpl/ledgerly-problem.jpg"
      },
      {
        "id": "product",
        "template": "device_mockup",
        "label": "Device mockup",
        "start": 6.01,
        "end": 9.5,
        "clipPoster": "/marketing/tpl/ledgerly-product.jpg",
        "clip": "/marketing/tpl/ledgerly-product.mp4"
      },
      {
        "id": "reminders",
        "template": "screenshot_zoom",
        "label": "Screenshot zoom",
        "start": 9.5,
        "end": 14.01,
        "clipPoster": "/marketing/tpl/ledgerly-reminders.jpg",
        "clip": "/marketing/tpl/ledgerly-reminders.mp4"
      },
      {
        "id": "features",
        "template": "feature_grid",
        "label": "Feature grid",
        "start": 14.01,
        "end": 18.51,
        "clipPoster": "/marketing/tpl/ledgerly-features.jpg"
      },
      {
        "id": "cta",
        "template": "cta",
        "label": "Call to action",
        "start": 18.51,
        "end": 22.01,
        "clipPoster": "/marketing/tpl/ledgerly-cta.jpg"
      },
      {
        "id": "logo",
        "template": "logo_reveal",
        "label": "Logo reveal",
        "start": 22.01,
        "end": 26.08,
        "clipPoster": "/marketing/tpl/ledgerly-logo.jpg"
      }
    ],
    "beats": [
      0,
      0.51,
      1,
      1.51,
      2,
      2.51,
      3,
      3.51,
      4.01,
      4.51,
      5.01,
      5.51,
      6.01,
      6.51,
      7.01,
      7.51,
      8,
      8.51,
      9.02,
      9.5,
      10.01,
      10.5,
      11,
      11.51,
      12.01,
      12.51,
      13.01,
      13.51,
      14.01,
      14.5,
      15.01,
      15.51,
      16.01,
      16.5,
      17.01,
      17.51,
      18,
      18.51,
      19,
      19.51,
      20,
      20.51,
      21.01,
      21.51,
      22.01,
      22.51,
      23.01,
      23.5,
      24,
      24.51,
      25.01,
      25.51,
      26.01
    ],
    "downbeats": [
      0,
      2,
      4.01,
      6.01,
      8,
      10.01,
      12.01,
      14.01,
      16.01,
      18,
      20,
      22.01,
      24,
      26.01
    ]
  },
  "kettle": {
    "brand": "Kettle & Crumb",
    "title": "Kettle & Crumb morning ad",
    "format": "9:16",
    "language": "en",
    "duration": 12.44,
    "src": "/marketing/showcase/kettle.mp4",
    "poster": "/marketing/showcase/kettle.jpg",
    "colors": [
      "#F59E0B",
      "#FB7185",
      "#1A120B",
      "#FFF7ED"
    ],
    "background": "#1A120B",
    "font": "Fraunces",
    "voice": "Emma (UK)",
    "music": {
      "track": "Life of Riley",
      "bpm": 101.83
    },
    "loudness": -14,
    "cuts": 3,
    "cutsOnBeat": 3,
    "scenes": [
      {
        "id": "hook",
        "template": "hero_text",
        "label": "Hero text",
        "start": 0,
        "end": 2.66,
        "clipPoster": "/marketing/tpl/kettle-hook.jpg"
      },
      {
        "id": "menu",
        "template": "feature_grid",
        "label": "Feature grid",
        "start": 2.66,
        "end": 6.19,
        "clipPoster": "/marketing/tpl/kettle-menu.jpg"
      },
      {
        "id": "cta",
        "template": "cta",
        "label": "Call to action",
        "start": 6.19,
        "end": 9.75,
        "clipPoster": "/marketing/tpl/kettle-cta.jpg"
      },
      {
        "id": "logo",
        "template": "logo_reveal",
        "label": "Logo reveal",
        "start": 9.75,
        "end": 12.44,
        "clipPoster": "/marketing/tpl/kettle-logo.jpg"
      }
    ],
    "beats": [
      0,
      0.65,
      1.19,
      1.67,
      2.11,
      2.66,
      3.27,
      3.86,
      4.45,
      5.03,
      5.62,
      6.19,
      6.8,
      7.39,
      7.97,
      8.59,
      9.18,
      9.75,
      10.3,
      10.9,
      11.49,
      12.09
    ],
    "downbeats": [
      0,
      2.11,
      4.45,
      6.8,
      9.18,
      11.49
    ]
  },
  "pulsefit": {
    "brand": "Pulsefit",
    "title": "Pulsefit square ad",
    "format": "1:1",
    "language": "en",
    "duration": 17.34,
    "src": "/marketing/showcase/pulsefit.mp4",
    "poster": "/marketing/showcase/pulsefit.jpg",
    "colors": [
      "#F43F5E",
      "#FACC15",
      "#0A0A0B",
      "#FAFAFA"
    ],
    "background": "#0A0A0B",
    "font": "Outfit",
    "voice": "Nicole (US)",
    "music": {
      "track": "Motivator",
      "bpm": 126.05
    },
    "loudness": -14.1,
    "cuts": 3,
    "cutsOnBeat": 3,
    "scenes": [
      {
        "id": "hook",
        "template": "kinetic_words",
        "label": "Kinetic words",
        "start": 0,
        "end": 2.86,
        "clipPoster": "/marketing/tpl/pulsefit-hook.jpg",
        "clip": "/marketing/tpl/pulsefit-hook.mp4"
      },
      {
        "id": "compare",
        "template": "comparison",
        "label": "Comparison",
        "start": 2.86,
        "end": 9.52,
        "clipPoster": "/marketing/tpl/pulsefit-compare.jpg",
        "clip": "/marketing/tpl/pulsefit-compare.mp4"
      },
      {
        "id": "cta",
        "template": "cta",
        "label": "Call to action",
        "start": 9.52,
        "end": 12.86,
        "clipPoster": "/marketing/tpl/pulsefit-cta.jpg"
      },
      {
        "id": "logo",
        "template": "logo_reveal",
        "label": "Logo reveal",
        "start": 12.86,
        "end": 17.34,
        "clipPoster": "/marketing/tpl/pulsefit-logo.jpg"
      }
    ],
    "beats": [
      0,
      0.47,
      0.95,
      1.43,
      1.9,
      2.38,
      2.86,
      3.33,
      3.81,
      4.28,
      4.76,
      5.24,
      5.72,
      6.21,
      6.67,
      7.14,
      7.62,
      8.11,
      8.57,
      9.05,
      9.52,
      10,
      10.48,
      10.95,
      11.43,
      11.9,
      12.41,
      12.86,
      13.33,
      13.83,
      14.29,
      14.77,
      15.24,
      15.72,
      16.22,
      16.67,
      17.14
    ],
    "downbeats": [
      0,
      1.9,
      3.81,
      5.72,
      7.62,
      9.52,
      11.43,
      13.33,
      15.24,
      17.14
    ]
  },
  "clearsight": {
    "brand": "Clearsight",
    "title": "Clearsight product video",
    "format": "16:9",
    "language": "en",
    "duration": 17.01,
    "src": "/marketing/showcase/clearsight.mp4",
    "poster": "/marketing/showcase/clearsight.jpg",
    "colors": [
      "#3B82F6",
      "#A78BFA",
      "#0A0F1C",
      "#E8EEFC"
    ],
    "background": "#0A0F1C",
    "font": "Sora",
    "voice": "George (UK)",
    "music": {
      "track": "Inspired",
      "bpm": 120.19
    },
    "loudness": -14,
    "cuts": 4,
    "cutsOnBeat": 4,
    "scenes": [
      {
        "id": "hook",
        "template": "hero_text",
        "label": "Hero text",
        "start": 0,
        "end": 3,
        "clipPoster": "/marketing/tpl/clearsight-hook.jpg"
      },
      {
        "id": "spotlight",
        "template": "feature_spotlight",
        "label": "Feature spotlight",
        "start": 3,
        "end": 7.51,
        "clipPoster": "/marketing/tpl/clearsight-spotlight.jpg",
        "clip": "/marketing/tpl/clearsight-spotlight.mp4"
      },
      {
        "id": "stat",
        "template": "stat_counter",
        "label": "Stat counter",
        "start": 7.51,
        "end": 11,
        "clipPoster": "/marketing/tpl/clearsight-stat.jpg",
        "clip": "/marketing/tpl/clearsight-stat.mp4"
      },
      {
        "id": "cta",
        "template": "cta",
        "label": "Call to action",
        "start": 11,
        "end": 14.5,
        "clipPoster": "/marketing/tpl/clearsight-cta.jpg"
      },
      {
        "id": "logo",
        "template": "logo_reveal",
        "label": "Logo reveal",
        "start": 14.5,
        "end": 17.01,
        "clipPoster": "/marketing/tpl/clearsight-logo.jpg"
      }
    ],
    "beats": [
      0,
      0.51,
      1,
      1.51,
      2,
      2.51,
      3,
      3.51,
      4.01,
      4.51,
      5.01,
      5.51,
      6.01,
      6.51,
      7.01,
      7.51,
      8,
      8.51,
      9.02,
      9.5,
      10.01,
      10.5,
      11,
      11.51,
      12.01,
      12.51,
      13.01,
      13.51,
      14.01,
      14.5,
      15.01,
      15.51,
      16.01,
      16.5,
      17.01
    ],
    "downbeats": [
      0,
      2,
      4.01,
      6.01,
      8,
      10.01,
      12.01,
      14.01,
      16.01
    ]
  },
  "ledgerlyHi": {
    "brand": "Ledgerly",
    "title": "Ledgerly launch (Hindi voiceover)",
    "format": "16:9",
    "language": "hi",
    "duration": 30.5,
    "src": "/marketing/showcase/ledgerlyHi.mp4",
    "poster": "/marketing/showcase/ledgerlyHi.jpg",
    "colors": [
      "#10B981",
      "#0EA5E9",
      "#F6F8F5",
      "#0B1F17"
    ],
    "background": "#F6F8F5",
    "font": "Plus Jakarta Sans",
    "voice": "Omega (Hindi)",
    "music": {
      "track": "Inspired",
      "bpm": 120.19
    },
    "loudness": -14,
    "cuts": 6,
    "cutsOnBeat": 6,
    "scenes": [
      {
        "id": "hook",
        "template": "kinetic_words",
        "label": "Kinetic words",
        "start": 0,
        "end": 3.51,
        "clipPoster": "/marketing/tpl/ledgerlyHi-hook.jpg"
      },
      {
        "id": "problem",
        "template": "problem_list",
        "label": "Problem list",
        "start": 3.51,
        "end": 8,
        "clipPoster": "/marketing/tpl/ledgerlyHi-problem.jpg"
      },
      {
        "id": "product",
        "template": "device_mockup",
        "label": "Device mockup",
        "start": 8,
        "end": 11.51,
        "clipPoster": "/marketing/tpl/ledgerlyHi-product.jpg"
      },
      {
        "id": "reminders",
        "template": "screenshot_zoom",
        "label": "Screenshot zoom",
        "start": 11.51,
        "end": 17.51,
        "clipPoster": "/marketing/tpl/ledgerlyHi-reminders.jpg"
      },
      {
        "id": "features",
        "template": "feature_grid",
        "label": "Feature grid",
        "start": 17.51,
        "end": 22.01,
        "clipPoster": "/marketing/tpl/ledgerlyHi-features.jpg"
      },
      {
        "id": "cta",
        "template": "cta",
        "label": "Call to action",
        "start": 22.01,
        "end": 26.01,
        "clipPoster": "/marketing/tpl/ledgerlyHi-cta.jpg"
      },
      {
        "id": "logo",
        "template": "logo_reveal",
        "label": "Logo reveal",
        "start": 26.01,
        "end": 30.5,
        "clipPoster": "/marketing/tpl/ledgerlyHi-logo.jpg"
      }
    ],
    "beats": [
      0,
      0.51,
      1,
      1.51,
      2,
      2.51,
      3,
      3.51,
      4.01,
      4.51,
      5.01,
      5.51,
      6.01,
      6.51,
      7.01,
      7.51,
      8,
      8.51,
      9.02,
      9.5,
      10.01,
      10.5,
      11,
      11.51,
      12.01,
      12.51,
      13.01,
      13.51,
      14.01,
      14.5,
      15.01,
      15.51,
      16.01,
      16.5,
      17.01,
      17.51,
      18,
      18.51,
      19,
      19.51,
      20,
      20.51,
      21.01,
      21.51,
      22.01,
      22.51,
      23.01,
      23.5,
      24,
      24.51,
      25.01,
      25.51,
      26.01,
      26.51,
      27.01,
      27.51,
      28.01,
      28.51,
      29.01,
      29.51,
      30.01
    ],
    "downbeats": [
      0,
      2,
      4.01,
      6.01,
      8,
      10.01,
      12.01,
      14.01,
      16.01,
      18,
      20,
      22.01,
      24,
      26.01,
      28.01,
      30.01
    ]
  }
} satisfies Record<string, Showcase>;
