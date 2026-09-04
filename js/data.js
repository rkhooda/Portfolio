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
    url: "https://cred-vaulte.vercel.app",
    img: "assets/img/covers/credvault.jpg",
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
    desc: "Discord dev-productivity bot — todos, streaks, XP, GitHub/LeetCode/Codeforces stats. All buttons, no syntax.",
    tags: ["AUTOMATION", "TOOLS"],
    year: "2025", dur: "05:01",
    url: "https://cult-bot.vercel.app",
    img: "assets/img/covers/cult-bot.svg",
    tint: "#9A9B6A",
  },
  {
    title: "Clixo",
    desc: "Decentralised data-labelling platform on Ethereum.",
    tags: ["WEB3", "WEB"],
    year: "2026", dur: "03:47",
    url: "https://clixoo.vercel.app",
    img: "assets/img/covers/clixo.svg",
    tint: "#7C8F6E",
  },
  {
    title: "Bellsy",
    desc: "npm package + VS Code extension that pings you when coding agents and CLI tasks finish, fail, or need approval.",
    tags: ["TOOLS"],
    year: "2025", dur: "02:48",
    url: "https://bellsy.vercel.app",
    img: "assets/img/covers/bellsy.svg",
    tint: "#C2B28A",
  },
  {
    title: "FlowPane",
    desc: "Lightweight, always-on-top desktop to-do app with a translucent UI.",
    tags: ["APPS", "TOOLS"],
    year: "2025", dur: "03:24",
    url: "https://flowpane.vercel.app",
    img: "assets/img/covers/flowpane.svg",
    tint: "#A9A18F",
  },
  {
    title: "ProcrastiNO",
    desc: "Aesthetic productivity tracker for pairs — todos, workouts, video journals.",
    tags: ["APPS"],
    year: "2026", dur: "03:12",
    url: "https://github.com/rkhooda/ProcrastiNO",
    img: "assets/img/covers/procrastino.svg",
    tint: "#B08968",
  },
  {
    title: "StatisticalStudies",
    desc: "Educational platform for statistics & math — lectures, UGC-NET prep, premium content.",
    tags: ["WEB", "APPS"],
    year: "2025", dur: "04:37",
    url: "https://statistical-studies.vercel.app",
    img: "assets/img/covers/statisticalstudies.jpg",
    tint: "#7E9089",
  },
  {
    title: "Developer Brain",
    desc: "My long-term engineering operating system — an AI-augmented knowledge base.",
    tags: ["TOOLS", "LAB"],
    year: "2026", dur: "∞",
    url: null, wip: true,
    tint: "#A98F62",
  },
];

/* SIDE B — experiments, games, small builds. Rendered as a tracklist.
   `blurb`, `stack` and `tint` only feed the hover card that follows the
   cursor — they are placeholders, swap them for the real copy. Adding an
   `img` here replaces the generated art in the card, same as Side A. */
window.BSIDES = [
  {
    title: "MaanKiBaat",
    desc: "Mental-health AI chatbot that actually listens.",
    blurb: "A judgment-free chat companion in Hindi and English. Tuned to listen first and suggest second — and to know when to step back.",
    stack: ["JavaScript", "HTML/CSS"],
    tags: ["AI"], year: "2024", dur: "02:31",
    url: "https://maan-ki-baat.vercel.app",
    img: "assets/img/covers/maankibaat.jpg",
    tint: "#8FA98F",
  },
  {
    title: "Recipify",
    desc: "AI recipe generator — fridge in, dinner out.",
    blurb: "Photograph the fridge, get a dinner you'll actually cook. Ranks recipes by what you already own instead of what a brand wants to sell you.",
    stack: ["JavaScript", "Python"],
    tags: ["AI"], year: "2024", dur: "01:58",
    url: "https://recipifyi.vercel.app",
    img: "assets/img/covers/recipify.jpg",
    tint: "#C2B28A",
  },
  {
    title: "SlotMachine",
    desc: "Multi-platform slot machine game.",
    blurb: "One reel engine, three front-ends. Built to learn how RNG, payout tables and pacing actually feel once they're in your hands.",
    stack: ["Python", "JavaScript"],
    tags: ["GAMES"], year: "2024", dur: "02:14",
    url: "https://slot-machine-casino.vercel.app",
    img: "assets/img/covers/slotmachine.jpg",
    tint: "#A98F62",
  },
  {
    title: "Payline Slot Engine",
    desc: "Classic payline slot — fixed grid, medium volatility, readable wins.",
    blurb: "A faithful payline slot: fixed 5×3 grid, medium volatility, wins you can read without a spreadsheet. Ships with its own maths sim.",
    stack: ["Python"],
    tags: ["GAMES"], year: "2026", dur: "--:--",
    url: null, wip: true,
    tint: "#B08968",
  },
  {
    title: "Flappy-Bird",
    desc: "The clone every builder owes the universe.",
    blurb: "Sixty lines of physics and a lifetime of regret. Collision maths written from scratch, because that was the whole point.",
    stack: ["Python", "Pygame"],
    tags: ["GAMES", "LAB"], year: "2023", dur: "00:45",
    url: "https://github.com/rkhooda/Flappy-Bird",
    img: "assets/img/covers/flappy-bird.png",
    tint: "#7E9089",
  },
  {
    title: "Snake",
    desc: "Python classic. Eats apples, teaches loops.",
    blurb: "Written the long way on purpose — no engine, no helpers, just a loop, a grid and a tail that keeps getting in the way.",
    stack: ["Python", "Pygame"],
    tags: ["GAMES", "LAB"], year: "2023", dur: "00:32",
    url: "https://github.com/rkhooda/snake-game",
    img: "assets/img/covers/snake-game.png",
    tint: "#9A9B6A",
  },
];

/* Loader greetings — kept short on purpose; the widely-read ones, then "Yo" */
window.HELLOS = ["Hello", "Hola", "Bonjour", "Ciao", "Hallo", "Olá", "Namaste", "Yo"];

window.QUIPS = [
  "built with caffeine and questionable decisions",
  "“it works on my machine” — me, lying",
  "warming up the tape…",
  "closing 47 open tabs…",
];
