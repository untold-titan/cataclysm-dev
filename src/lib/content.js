// All portfolio content lives here. Edit freely — the 3D scene and UI read from this file.
// `scene` controls where each destination sits in space and how its asteroid looks.

const GH = 'https://github.com/untold-titan';

export const profile = {
  name: 'Cataclysm',
  title: 'Software Developer',
  tagline:
    'Lead Developer at Telos One. I build apps, tools and games — from Flutter and .NET to the web, and the odd spaceship.',
  location: 'Canada',
  // Optional: add a public email address to show it on the Comms Relay.
  email: 'hello@cataclysm.dev',
  links: [
    { label: 'GitHub', url: GH },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/mitchell-dev/' },
  ],
};

export const destinations = [
  {
    id: 'home',
    kind: 'home',
    label: 'Launch Point',
    short: 'Home',
    key: '0',
    scene: { position: [0, 0, 0], orbitRadius: 10, tilt: 0.12, camera: [0, 30, 72] },
  },
  {
    id: 'projects',
    kind: 'projects',
    label: 'Projects',
    designation: 'AST-01',
    short: 'Projects',
    key: '1',
    color: '#ff7a3d',
    blurb: 'Apps, games, tools and sites I have built — from hackathon weekends to long-running side projects.',
    scene: { position: [-31, 3, -16], radius: 5.2, seed: 11, tilt: 0.25 },
    items: [
      {
        name: 'cataclysm.dev',
        year: '2026',
        summary: 'This site — a Svelte + three.js portfolio where a spaceship flies you between asteroids.',
        tags: ['Svelte', 'three.js', 'GLSL', 'Cloudflare'],
        links: [{ label: 'Source', url: `${GH}/cataclysm-dev` }],
      },
      {
        name: 'Grid Runner',
        year: '2026',
        summary:
          'CalgaryHacks 2026 entry: a visual programming puzzle game where players drag and drop code blocks to steer vehicles through grid-based levels.',
        tags: ['Blazor WebAssembly', '.NET 8', 'SignalR', 'PWA'],
        links: [{ label: 'Source', url: `${GH}/Grid-Runner` }],
      },
      {
        name: "Amy's Art",
        year: '2026',
        summary:
          'A memorial gallery and print shop for my cousin Amy — filterable gallery, per-artwork pages, her story, and Stripe-powered print orders.',
        tags: ['Astro', 'Stripe'],
        links: [{ label: 'Source', url: `${GH}/amynewsite` }],
      },
      {
        name: 'Agito',
        year: '2023',
        summary:
          'An AI-powered Dungeons & Dragons character manager with on-device storage, a guide for first-time players, and character import.',
        tags: ['Flutter', 'Dart'],
        links: [{ label: 'Source', url: `${GH}/Agito` }],
      },
      {
        name: 'Bonelab Mod Manager',
        year: '2023',
        summary: 'A mod manager for Bonelab that talks to the mod.io API to search for, download and install mods.',
        tags: ['Flutter', 'Dart', 'mod.io API'],
        links: [{ label: 'Source', url: `${GH}/Bonelab-Mod-Manager` }],
      },
      {
        name: 'Space Exploration',
        year: '2023',
        summary:
          'A multiplayer space-trading game inspired by No Man’s Sky, with clients talking to a game server over WebSockets. My Computer Science final project.',
        tags: ['Java', 'WebSockets', 'Multiplayer'],
        links: [{ label: 'Source', url: `${GH}/space-exploration` }],
      },
      {
        name: 'Baller',
        year: '2022',
        summary:
          'An arcade mobile game — my first. It was on the Google Play Store and peaked at 50 players before a policy change got it delisted.',
        tags: ['Unity', 'C#'],
        links: [],
      },
    ],
  },
  {
    id: 'career',
    kind: 'career',
    label: 'Career',
    designation: 'AST-02',
    short: 'Career',
    key: '2',
    color: '#8b6cff',
    blurb: 'From summer internships to leading a team — where I have worked and what I built there.',
    scene: { position: [6, -2, -26], radius: 4.6, seed: 23, tilt: -0.2 },
    items: [
      {
        role: 'Software Developer',
        company: 'GNO-SYS Technology',
        period: 'Jul 2025 — Present · Contract, remote',
        summary: 'Building a custom, data-driven full-stack application.',
        highlights: [
          'SvelteKit frontend backed by a C# / ASP.NET API with Entity Framework Core',
          'PostgreSQL data model and database design',
        ],
      },
      {
        role: 'Lead Developer',
        company: 'Telos One',
        period: 'May 2024 — Present · Contract, remote',
        summary: 'Leading a team of two developers to design, scope and build custom software for clients.',
        highlights: [
          'Built a large data connector that pulls data from an FTP server, deserializes it and syncs it to an eCommerce platform over HTTP',
          'Developed custom applications in C# / ASP.NET, and client sites with WordPress and WooCommerce',
          'Ran projects end to end without a dedicated project manager, consistently meeting deadlines',
          'Translated technical progress for non-technical clients and managers',
        ],
      },
      {
        role: 'Software Developer',
        company: 'Canada First Ammo Corp.',
        period: 'Nov 2023 — Apr 2024 · Contract',
        summary: "Designed and developed custom, proprietary software for Canada First's warehouse operations.",
        highlights: [],
      },
      {
        role: 'Software Development Diploma',
        company: 'SAIT',
        period: 'Sep 2023 — May 2025',
        summary: 'Software Development at the Southern Alberta Institute of Technology. GPA 3.59 / 4.00.',
        highlights: [
          'Chair of the IEEE Student Branch, organizing events and workshops for students',
          'C#, Java, JavaScript, mobile (Kotlin, React Native), secure coding and Docker',
        ],
      },
      {
        role: 'Software Developer Intern',
        company: 'Arcurve',
        period: 'Summers 2022 & 2023',
        summary: 'Two summer internships building client projects alongside experienced developers.',
        highlights: [
          '2023: client work in Blazor and C#',
          '2022: user-friendly interfaces in React.js, Formik and JavaScript',
          "Helped organize an intern CSR board-game night that raised $2,995 for Wood's Homes",
        ],
      },
      {
        role: 'Hackathons',
        company: 'CalgaryHacks',
        period: '2025 — 2026',
        summary: 'I enjoy building something from nothing in a weekend.',
        highlights: [
          '2026: Grid Runner, a programming puzzle game in Blazor WebAssembly',
          '2025: Independapp, a budgeting and independence app built with Svelte',
        ],
      },
    ],
  },
  {
    id: 'stack',
    kind: 'stack',
    label: 'Tech Stack',
    designation: 'AST-03',
    short: 'Stack',
    key: '3',
    color: '#2ee6c5',
    blurb: 'The languages, frameworks and tools I build with.',
    scene: { position: [17, 2, 18], radius: 4.2, seed: 37, tilt: 0.3 },
    groups: [
      { label: 'Languages', items: ['C#', 'JavaScript', 'TypeScript', 'Java', 'Dart', 'Python', 'Kotlin'] },
      { label: 'Frontend & Apps', items: ['Svelte / SvelteKit', 'React', 'React Native', 'Flutter', 'Astro', 'Blazor', 'Formik'] },
      { label: 'Backend & Data', items: ['ASP.NET', 'Entity Framework Core', 'PostgreSQL', 'SignalR', 'WebSockets', 'REST APIs', 'Stripe'] },
      { label: 'Infrastructure', items: ['Docker', 'Nginx', 'Azure', 'Netlify', 'Cloudflare', 'Self-hosted GitLab'] },
      { label: 'Games & 3D', items: ['Unity', 'Blender', 'three.js'] },
      { label: 'CMS & Commerce', items: ['WordPress', 'WooCommerce'] },
      { label: 'Practices', items: ['Git', 'Agile', 'Software design', 'Client communication'] },
    ],
  },
  {
    id: 'contact',
    kind: 'contact',
    label: 'Comms Relay',
    designation: 'AST-04',
    short: 'Contact',
    key: '4',
    color: '#ff4f8b',
    blurb: 'Open a channel. Send me an email, or find me on GitHub and LinkedIn.',
    scene: { position: [-9, -4, 21], radius: 2.6, seed: 51, tilt: -0.3 },
  },
];
