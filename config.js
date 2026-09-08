const DEFAULT_SITE = {
  // ---- Theme & Background Customization ----
  theme: {
    backgroundType: "video", // "color", "image", or "video"
    backgroundColor: "#120F1A",
    backgroundImage: "college_event_1.jpg",
    backgroundVideo: "Event_TAKSHAK_2026.mp4",
    overlayOpacity: 0.72, // 0.0 to 1.0 (darkens background for readability)
    overlayBlur: 2, // px blur on background
    accentColor: "#FF5A5F"
  },

  // ---- Hero section ----
  name: "SASIKUMAR",
  eyebrow: "Visual Storyteller & Video Editor",
  tagline: "I edit videos, shoot photos, and design creative visuals — this is where it all lives. Take a look around.",

  // ---- About section ----
  aboutPhoto: "sasi_profile.jpg",
  location: "📍 Based in Chennai",
  aboutParagraph1: "I'm a self-taught video editor and photographer based in Chennai. What started as cutting clips for fun turned into a full creative practice spanning short films, music videos, and cinematic visual experiences.",
  aboutParagraph2: "I love projects that mix motion, dynamic rhythm, color grading, and sound in unexpected ways. When I'm not in the edit suite, I'm capturing live events, street photography, and creative productions.",
  stats: [
    { number: "50+", label: "Projects" },
    { number: "4yrs", label: "Experience" },
    { number: "12", label: "Awards" }
  ],
  skills: ["Premiere Pro", "DaVinci Resolve", "After Effects", "Color Grading", "Sound Design", "Lightroom", "Cinematography"],

  // ---- Videos Showcase ----
  // type: "file" (local mp4 or video URL) or "youtube" (with youtubeId)
  videos: [
    {
      title: "TAKSHAK 2026 — College Event Aftermovie",
      desc: "Event Highlights · Cinematic Cut · 4K",
      type: "file",
      file: "Event_TAKSHAK_2026.mp4",
      thumbnail: "college_event_1.jpg"
    },
    {
      title: "Visual Edit Reel — Motion & Grading",
      desc: "Creative Showcase · Motion Graphics",
      type: "file",
      file: "VID_20260624_005809_508.mp4",
      thumbnail: "college_event_2.jpg"
    },
    {
      title: "City Lights — Short Film",
      desc: "Music video · 2:14",
      type: "youtube",
      youtubeId: "dQw4w9WgXcQ",
      thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=600&q=80"
    }
  ],

  // ---- Photos Gallery ----
  photos: [
    { src: "college_event_1.jpg", caption: "Takshak Event Live Highlights" },
    { src: "college_event_2.jpg", caption: "Campus Festival Celebration" },
    { src: "sasi_profile.jpg", caption: "Portrait Session & Creative Look" },
    { src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=700&q=80", caption: "Golden Hour, Marina Beach" },
    { src: "https://images.unsplash.com/photo-1517022812141-23620dba5c23?w=700&q=80", caption: "Studio Portraits" },
    { src: "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?w=700&q=80", caption: "Street Life, Chennai" }
  ],

  // ---- Contact ----
  phone: "+91 98765 43210",
  email: "sasi.editz@example.com",
  socials: [
    { name: "Instagram", handle: "@sasi_editz", url: "https://instagram.com" },
    { name: "YouTube", handle: "Sasi Editz Official", url: "https://youtube.com" },
    { name: "Spotify", handle: "Sasi Soundscape", url: "https://open.spotify.com" },
    { name: "LinkedIn", handle: "Sasikumar Editor", url: "https://linkedin.com" }
  ]
};

// Expose SITE initialized from localStorage if customized, otherwise DEFAULT_SITE
let SITE = (function() {
  try {
    const saved = localStorage.getItem("SASI_PORTFOLIO_CONFIG");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults in case of missing keys
      return Object.assign({}, DEFAULT_SITE, parsed, {
        theme: Object.assign({}, DEFAULT_SITE.theme, parsed.theme || {})
      });
    }
  } catch (e) {
    console.warn("Could not load stored config, using defaults:", e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SITE));
})();
