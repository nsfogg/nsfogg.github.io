export const profile = {
  name: 'Nick Fogg',
  role: 'Software Engineer II at Cisco',
  location: 'Raleigh, NC',
  email: 'nicksfogg@gmail.com',
  linkedin: 'https://www.linkedin.com/in/nick-fogg',
  github: 'https://github.com/nsfogg',
};

export const about = {
  lead:
    'I build software that makes big systems feel fast and simple — from enterprise planning tools to apps I use every day.',
  body: [
    'I’m a software engineer on Cisco’s AI & IT Software Asset Management team, where I own and rebuild the applications Cisco uses to manage its software assets. Before that I spent a year at Prometheus Group making an enterprise planning grid seven times faster, and a summer at John Deere automating analysis engineers used to do by hand.',
    'I studied Computer Science at NC State, with a minor in Global Leadership and time studying abroad. Outside of work I build things I actually want to exist: an app that finds where you crossed paths with friends, a home search that knows which houses are really on the water, and a plant tracker that texts me when it’s time to water.',
  ],
};

export type Stat = { value: string; label: string };

export const stats: Stat[] = [
  { value: '7×', label: 'Faster page loads on an enterprise planning grid' },
  { value: '10 hrs', label: 'Of manual engineering work saved every week at John Deere' },
  { value: '10+', label: 'Enterprise customers running software I owned' },
  { value: '50K+', label: 'Anime titles indexed for semantic search' },
];

export type Role = {
  company: string;
  title: string;
  team?: string;
  start: string;
  end: string;
  current?: boolean;
  points: string[];
  stack: string[];
};

export const experience: Role[] = [
  {
    company: 'Cisco',
    title: 'Software Engineer II',
    team: 'AI & IT Software Asset Management',
    start: 'Jun 2026',
    end: 'Present',
    current: true,
    points: [
      'Own, migrate and rebuild several critical asset-management applications.',
      'Automated in-depth contract savings calculations.',
      'Resolved dozens of critical vulnerabilities, some of which had been in our applications for years.',
      'Optimized queries across the platform and designed a new data model.',
    ],
    stack: ['React', 'Java', 'Spring Boot', 'MongoDB', 'Python'],
  },
  {
    company: 'Prometheus Group',
    title: 'Software Engineer',
    start: 'May 2025',
    end: 'May 2026',
    points: [
      'Owned end-to-end development of a production resource-planning grid used by tens of thousands of people across 10+ enterprise customers — Spring Boot services, PostgreSQL APIs and React/Redux components that integrate SAP data through WSDL mappings.',
      'Revived an abandoned performance investigation. React profiling plus horizontal and vertical virtualization with dynamic cell sizing cut page load from 1,100 ms to 150 ms and row operations from 11 s to 1.6 s.',
      'Delivered 3 major releases and 20+ customer hotfixes, working with QA, product managers and SAP developers to resolve production issues within 3-day SLAs.',
      'Onboarded an international teammate through two weeks of architecture training, and served as a go-to technical resource and regular code reviewer.',
    ],
    stack: ['Java', 'Spring Boot', 'PostgreSQL', 'React', 'Redux', 'SAP'],
  },
  {
    company: 'John Deere',
    title: 'Product Engineer Intern',
    start: 'May 2024',
    end: 'Aug 2024',
    points: [
      'Automated wiring-harness BOM analysis with SQL and Python, consolidating several data sources and eliminating 10 hours of manual engineering work per week (about $1M a year in opportunity cost).',
      'Analyzed 1M+ part numbers and built Power BI dashboards on connector complexity, supplier cost and usage trends that informed bulk-ordering and procurement decisions.',
    ],
    stack: ['Python', 'SQL', 'Power BI'],
  },
];

export type ProjectArt = 'crossings' | 'waterfront' | 'plant' | 'search';

export type Project = {
  name: string;
  tagline: string;
  description: string;
  details: string[];
  stack: string[];
  art: ProjectArt;
  code: string;
  live?: string;
};

export const projects: Project[] = [
  {
    name: 'Crossi Clone',
    tagline: 'How many times did you cross paths before you met?',
    description:
      'An open-source rebuild of the Crossi app. It reads the location and time saved in your photos, clusters them into visits and compares them with a friend’s. Any time you were both within a few hundred metres in the same hour counts as a crossing.',
    details: [
      'One TypeScript matching engine shared by a web app, an Expo mobile app for iOS and Android, a Node and SQLite server and a command-line tool.',
      'Also imports Google Maps Timeline exports and GPX tracks, which are far denser than photos.',
      'Private by design: photos never leave the device, only rounded visits are uploaded, and crossings are computed only between mutual friends.',
    ],
    stack: ['TypeScript', 'React Native', 'Expo', 'Node.js', 'SQLite', 'Leaflet'],
    art: 'crossings',
    code: 'https://github.com/nsfogg/crossi-clone',
  },
  {
    name: 'Property Finder',
    tagline: 'Home search that knows which houses are really on the water.',
    description:
      'A listing search app that ingests for-sale listings into PostGIS and flags waterfront homes by checking each property against real OpenStreetMap lake, river and coastline shapes — not by trusting the listing text.',
    details: [
      'Pluggable source adapters feed a scheduled ingestion pipeline that deduplicates listings across sources and keeps each raw payload next to its normalized row.',
      'A composable filter API covers price, size, lot, year built, days on market, amenities pulled from descriptions and distance from any city.',
      'Saved searches are re-checked on every ingestion run and raise alerts for new matches, shown on a clustered map that stays in sync with the results list.',
    ],
    stack: ['Python', 'FastAPI', 'PostgreSQL', 'PostGIS', 'React', 'Leaflet', 'Docker'],
    art: 'waterfront',
    code: 'https://github.com/nsfogg/property-finder',
  },
  {
    name: 'Plant Care',
    tagline: 'A plant-watering tracker that runs entirely on GitHub.',
    description:
      'No server, no database, nothing to pay for. The site is static and served by GitHub Pages, the plant data is a JSON file in the repository, and a scheduled GitHub Action texts me each morning with what needs water.',
    details: [
      'Installs like an app and works offline; changes publish back to the repository through the GitHub API.',
      'Safe to edit from two devices: publishing merges plant by plant using timestamps, and deletions are remembered so a stale device can’t bring a plant back.',
      'Photos are shrunk in the browser before saving, and a calendar feed lets any phone subscribe to watering days.',
    ],
    stack: ['JavaScript', 'PWA', 'GitHub Actions', 'GitHub Pages', 'Python'],
    art: 'plant',
    code: 'https://github.com/nsfogg/plant_watering',
    live: 'https://nsfogg.github.io/plant_watering/',
  },
  {
    name: 'Anime Semantic Search',
    tagline: 'Describe the show you want, in plain English.',
    description:
      'A search engine for 50K+ anime titles. Queries like “humans who fight gods” are matched on meaning, not keywords, using transformer embeddings and a FAISS vector index.',
    details: [
      'A weighted ranking blends synopsis, genre and review embeddings with configurable similarity thresholds.',
      'Ingestion built for scale, with checkpointing, batch processing and graceful failure handling.',
      'Served by a Flask REST API with rate limiting, with the model preloaded to cut cold-start latency.',
    ],
    stack: ['Python', 'Sentence-Transformers', 'FAISS', 'Flask'],
    art: 'search',
    code: 'https://github.com/nsfogg/semantic-search',
  },
];

export const education = {
  school: 'North Carolina State University',
  degree: 'Bachelor of Science in Computer Science',
  start: 'Aug 2021',
  end: 'May 2025',
  facts: ['GPA 3.6 / 4.0', 'Minor in Global Leadership', 'Studied abroad'],
};

export const skills: { group: string; items: string[] }[] = [
  { group: 'Languages', items: ['Java', 'Python', 'TypeScript', 'JavaScript', 'SQL'] },
  { group: 'Frameworks', items: ['Spring Boot', 'React', 'Redux', 'Flask', 'FastAPI'] },
  { group: 'Data', items: ['PostgreSQL', 'MongoDB', 'PostGIS', 'FAISS'] },
  { group: 'AI & ML', items: ['LLMs', 'Transformer embeddings', 'Semantic search', 'Anomaly detection'] },
  { group: 'Tools', items: ['Git', 'REST APIs', 'Unix/Linux', 'Postman', 'Quay', 'Cursor', 'Codex'] },
  { group: 'Strengths', items: ['Performance optimization', 'State management', 'SAP integration'] },
];
