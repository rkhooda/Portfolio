/* ------------------------------------------------------------------
   data.js — single source of truth for everything editable.
   Add / reorder projects here; the site renders from these arrays.
   To use a real screenshot on a card: set `img: "assets/img/foo.png"`.
   ------------------------------------------------------------------ */

window.SITE = {
  email: "rakshit.official703@gmail.com",
  github: "https://github.com/rkhooda",
  linkedin: "https://www.linkedin.com/in/rakshit-hooda/",
  albumLength: 245, // "album" duration in seconds — scroll maps onto this
};

/* Track titles shown in the mini-player as you scroll each section */
window.TRACKS = [
  { id: "top",     name: "Intro — Night Sage" },
  { id: "work",    name: "Selected Work — Side A" },
  { id: "lab",     name: "The Lab — B-Sides" },
  { id: "about",   name: "Liner Notes — About" },
  { id: "contact", name: "Outro — Let's Talk" },
];

/* SIDE A — the main gallery. wip:true = "UNRELEASED" (no link needed). */
window.PROJECTS = [
  {
    title: "CredVault",
    desc: "Secure, decentralized issuance & verification of credentials on the blockchain.",
    tags: ["WEB3", "PLATFORM"],
    year: "2025", dur: "04:12",
    url: "https://github.com/rkhooda/CredVault",
    tint: "#8FA98F",
  },
  {
    title: "Multiagent Builder",
    desc: "Multi-agent AI system for end-to-end product development.",
    tags: ["AI", "SYSTEM"],
    year: "2026", dur: "--:--",
    url: null, wip: true,
    tint: "#A8B58A",
  },
  {
    title: "Cult-Bot",
    desc: "Turns a Discord server into a developer productivity OS — todos, goals, focus, XP. All buttons, no syntax.",
    tags: ["AUTOMATION", "TOOLS"],
    year: "2025", dur: "05:01",
    url: "https://github.com/rkhooda/Cult-Bot",
    tint: "#9A9B6A",
  },
  {
    title: "Clixo",
    desc: "Decentralised data-labelling platform on Ethereum.",
    tags: ["WEB3", "WEB"],
    year: "2026", dur: "--:--",
    url: null, wip: true,
    tint: "#7C8F6E",
  },
  {
    title: "Bellsy",
    desc: "npm package + VS Code extension that pings you when coding agents and CLI tasks finish, fail, or need approval.",
    tags: ["TOOLS"],
    year: "2025", dur: "02:48",
    url: "https://github.com/rkhooda/Bellsy",
    tint: "#C2B28A",
  },
  {
    title: "FlowPane",
    desc: "Lightweight, always-on-top desktop to-do app with a translucent UI.",
    tags: ["APPS", "TOOLS"],
    year: "2025", dur: "03:24",
    url: "https://github.com/rkhooda/FlowPane",
    tint: "#A9A18F",
  },
  {
    title: "ProcrastiNO",
    desc: "Aesthetic productivity tracker — todos, workouts, video journals.",
    tags: ["APPS"],
    year: "2026", dur: "--:--",
    url: null, wip: true,
    tint: "#B08968",
  },
  {
    title: "StatisticalStudies",
    desc: "Educational platform for statistics & math — lectures, UGC-NET prep, premium content.",
    tags: ["WEB", "APPS"],
    year: "2025", dur: "04:37",
    url: "https://github.com/rkhooda/StatisticalStudies",
    tint: "#7E9089",
  },
  {
    title: "Developer Brain",
    desc: "My long-term engineering operating system — an AI-augmented knowledge base.",
    tags: ["TOOLS", "LAB"],
    year: "2026", dur: "∞",
    url: "https://github.com/rkhooda/developer-brain",
    tint: "#A98F62",
  },
];

/* SIDE B — experiments, games, small builds. Rendered as a tracklist. */
window.BSIDES = [
  {
    title: "MaanKiBaat",
    desc: "Mental-health AI chatbot that actually listens.",
    tags: ["AI"], year: "2024", dur: "02:31",
    url: "https://github.com/rkhooda/MaanKiBaat",
  },
  {
    title: "Recipify",
    desc: "AI recipe generator — fridge in, dinner out.",
    tags: ["AI"], year: "2024", dur: "01:58",
    url: "https://github.com/rkhooda/Recipify",
  },
  {
    title: "SlotMachine",
    desc: "Multi-platform slot machine game.",
    tags: ["GAMES"], year: "2024", dur: "02:14",
    url: "https://github.com/rkhooda/SlotMachine",
  },
  {
    title: "Payline Slot Engine",
    desc: "Classic payline slot — fixed grid, medium volatility, readable wins.",
    tags: ["GAMES"], year: "2026", dur: "--:--",
    url: null, wip: true,
  },
  {
    title: "Flappy-Bird",
    desc: "The clone every builder owes the universe.",
    tags: ["GAMES", "LAB"], year: "2023", dur: "00:45",
    url: "https://github.com/rkhooda/Flappy-Bird",
  },
  {
    title: "Snake",
    desc: "Python classic. Eats apples, teaches loops.",
    tags: ["GAMES", "LAB"], year: "2023", dur: "00:32",
    url: "https://github.com/rkhooda/snake-game",
  },
];

/* Loader one-liners — rotate while the counter runs */
window.HELLOS = [
  "Hello", "Hola", "Bonjour", "Ciao", "Hallo", "Olá", "Namaste",
  "こんにちは", "안녕", "你好", "Привет", "Merhaba", "Salam",
  "Xin chào", "Sawubona", "Aloha", "Shalom", "Hej", "Ahoj", "Yo",
];

window.QUIPS = [
  "built with caffeine and questionable decisions",
  "“it works on my machine” — me, lying",
  "warming up the tape…",
  "closing 47 open tabs…",
];
