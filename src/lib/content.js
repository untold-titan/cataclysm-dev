// All portfolio content lives here. Edit freely — the 3D scene and UI read from this file.
// `scene` controls where each destination sits in space and how its asteroid looks.

export const profile = {
  name: 'Cataclysm',
  title: 'Software Engineer',
  tagline: 'I build fast, thoughtful software — from the first pixel to production.',
  location: 'Earth · Sol System',
  email: 'hello@cataclysm.dev',
  links: [
    { label: 'GitHub', url: 'https://github.com/' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/' },
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
    blurb: 'Things I have designed, built and shipped. Each one taught me something new.',
    scene: { position: [-31, 3, -16], radius: 5.2, seed: 11, tilt: 0.25 },
    items: [
      {
        name: 'Project Nebula',
        year: '2026',
        summary:
          'A real-time collaborative whiteboard with CRDT-based sync, offline support and sub-50ms cursor latency.',
        tags: ['SvelteKit', 'TypeScript', 'Yjs', 'WebSockets'],
        links: [
          { label: 'Live', url: '#' },
          { label: 'Source', url: '#' },
        ],
      },
      {
        name: 'Orbit CLI',
        year: '2025',
        summary:
          'A developer tool that scaffolds, tests and deploys microservices with a single command. Used by 2k+ developers.',
        tags: ['Go', 'Docker', 'GitHub Actions'],
        links: [{ label: 'Source', url: '#' }],
      },
      {
        name: 'Stellar Metrics',
        year: '2024',
        summary:
          'Observability dashboard that turns raw telemetry into readable stories, with anomaly detection and alerting.',
        tags: ['React', 'D3', 'Rust', 'ClickHouse'],
        links: [{ label: 'Case study', url: '#' }],
      },
      {
        name: 'cataclysm.dev',
        year: '2026',
        summary: 'This site — a Svelte + three.js portfolio where a ship flies you between asteroids.',
        tags: ['Svelte', 'three.js', 'GLSL'],
        links: [{ label: 'Source', url: '#' }],
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
    blurb: 'Where I have worked, and what I did while I was there.',
    scene: { position: [6, -2, -26], radius: 4.6, seed: 23, tilt: -0.2 },
    items: [
      {
        role: 'Senior Software Engineer',
        company: 'Acme Orbital',
        period: '2023 — Present',
        summary: 'Lead engineer on the platform team, owning the core APIs and developer experience.',
        highlights: [
          'Cut p95 API latency by 60% by redesigning the caching layer',
          'Mentored 5 engineers and ran the frontend guild',
          'Drove the migration from a monolith to event-driven services',
        ],
      },
      {
        role: 'Software Engineer',
        company: 'Starlight Labs',
        period: '2020 — 2023',
        summary: 'Full-stack product engineer across web, mobile and data pipelines.',
        highlights: [
          'Shipped the v2 web app used by 200k monthly users',
          'Built the analytics ingestion pipeline processing 1B events/day',
        ],
      },
      {
        role: 'Junior Developer',
        company: 'Comet Studio',
        period: '2018 — 2020',
        summary: 'Agency work building marketing sites, e-commerce and internal tools for clients.',
        highlights: ['Delivered 20+ client projects', 'Introduced automated testing and CI'],
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
    blurb: 'The tools I reach for, and the ones I know well enough to argue about.',
    scene: { position: [17, 2, 18], radius: 4.2, seed: 37, tilt: 0.3 },
    groups: [
      { label: 'Languages', items: ['TypeScript', 'JavaScript', 'Go', 'Rust', 'Python', 'SQL', 'GLSL'] },
      { label: 'Frontend', items: ['Svelte / SvelteKit', 'React', 'three.js', 'Tailwind', 'Vite'] },
      { label: 'Backend', items: ['Node.js', 'PostgreSQL', 'Redis', 'GraphQL', 'gRPC'] },
      { label: 'Infrastructure', items: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'Cloudflare'] },
      { label: 'Practices', items: ['Testing', 'CI/CD', 'Observability', 'Accessibility', 'System design'] },
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
    blurb: 'Open a channel. I am always happy to talk about interesting problems, roles and collaborations.',
    scene: { position: [-9, -4, 21], radius: 2.6, seed: 51, tilt: -0.3 },
  },
];
