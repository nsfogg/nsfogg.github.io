import { about, education, experience, profile, projects, skills, stats } from './content';
import { useActiveSection, useReveal } from './hooks';
import ProjectArt from './components/ProjectArt';
import { ArrowIcon, ChevronIcon, GitHubIcon, LinkedInIcon } from './components/Icons';

const sections = [
  { id: 'about', label: 'About' },
  { id: 'experience', label: 'Experience' },
  { id: 'projects', label: 'Projects' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
];
const sectionIds = sections.map((s) => s.id);

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowIcon />
    </a>
  );
}

function Profile({ active }: { active: string }) {
  return (
    <aside className="profile">
      <picture>
        <source srcSet="/headshot.webp" type="image/webp" />
        <img className="headshot" src="/headshot.jpg" alt="Portrait of Nick Fogg" width={720} height={900} />
      </picture>
      <div className="profile-id">
        <h1 className="name">{profile.name}</h1>
        <p className="profile-role">{profile.role}</p>
        <p className="location">{profile.location}</p>
      </div>

      <nav className="toc" aria-label="Sections">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined}>
            {s.label}
          </a>
        ))}
      </nav>

      <div className="profile-actions">
        <a className="btn-primary" href={`mailto:${profile.email}`}>
          Email me
        </a>
        <a className="icon-button" href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <LinkedInIcon />
        </a>
        <a className="icon-button" href={profile.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <GitHubIcon />
        </a>
      </div>
    </aside>
  );
}

function About() {
  return (
    <section id="about" className="section" aria-labelledby="about-title">
      <h2 id="about-title" className="eyebrow reveal">About</h2>
      <p className="lead reveal">{about.lead}</p>
      {about.body.map((p) => (
        <p key={p.slice(0, 24)} className="body reveal">
          {p}
        </p>
      ))}
      <ul className="stats reveal" aria-label="Highlights">
        {stats.map((s) => (
          <li key={s.label} className="stat">
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tags({ items, label }: { items: string[]; label: string }) {
  return (
    <ul className="tags" aria-label={label}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function Experience() {
  return (
    <section id="experience" className="section" aria-labelledby="experience-title">
      <h2 id="experience-title" className="section-title reveal">Experience</h2>
      <ol className="roles">
        {experience.map((r) => (
          <li key={r.company} className="role reveal">
            <div className="role-head">
              <h3 className="role-company">
                {r.company}
                {r.current && <span className="badge">Current</span>}
              </h3>
              <p className="role-dates">
                {r.start} – {r.end}
              </p>
            </div>
            <p className="role-title">
              {r.title}
              {r.team && <span> · {r.team}</span>}
            </p>
            <ul className="points">
              {r.points.map((p) => (
                <li key={p.slice(0, 24)}>{p}</li>
              ))}
            </ul>
            <Tags items={r.stack} label={`Technologies used at ${r.company}`} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Projects() {
  return (
    <section id="projects" className="section" aria-labelledby="projects-title">
      <h2 id="projects-title" className="section-title reveal">Projects</h2>
      <p className="section-intro reveal">Things I’ve built on my own time, end to end.</p>
      <div className="projects">
        {projects.map((p) => (
          <article key={p.name} className={`card project reveal art-${p.art}`}>
            <div className="project-art">
              <ProjectArt kind={p.art} />
            </div>
            <div className="project-body">
              <h3 className="project-name">{p.name}</h3>
              <p className="project-tagline">{p.tagline}</p>
              <p className="project-description">{p.description}</p>
              <details className="project-details">
                <summary>
                  How it works
                  <ChevronIcon />
                </summary>
                <ul className="points">
                  {p.details.map((d) => (
                    <li key={d.slice(0, 24)}>{d}</li>
                  ))}
                </ul>
              </details>
              <Tags items={p.stack} label={`Technologies used in ${p.name}`} />
              <div className="project-links">
                <ExternalLink href={p.code}>View code</ExternalLink>
                {p.live && <ExternalLink href={p.live}>Open app</ExternalLink>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Education() {
  return (
    <section id="education" className="section" aria-labelledby="education-title">
      <h2 id="education-title" className="section-title reveal">Education</h2>
      <div className="education reveal">
        <div className="role-head">
          <h3 className="role-company">{education.school}</h3>
          <p className="role-dates">
            {education.start} – {education.end}
          </p>
        </div>
        <p className="role-title">{education.degree}</p>
        <ul className="facts">
          {education.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Skills() {
  return (
    <section id="skills" className="section" aria-labelledby="skills-title">
      <h2 id="skills-title" className="section-title reveal">Skills</h2>
      <dl className="skills reveal">
        {skills.map((g) => (
          <div key={g.group} className="skill-row">
            <dt>{g.group}</dt>
            <dd>
              <Tags items={g.items} label={g.group} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <h2 id="contact-title" className="section-title reveal">Let’s talk.</h2>
      <p className="body reveal">
        I’m always happy to talk about software, performance work or a project you’re building.
      </p>
      <p className="reveal">
        <a className="contact-email" href={`mailto:${profile.email}`}>
          {profile.email}
        </a>
      </p>
      <div className="contact-links reveal">
        <ExternalLink href={profile.linkedin}>LinkedIn</ExternalLink>
        <ExternalLink href={profile.github}>GitHub</ExternalLink>
      </div>
      <p className="footer-note">© {new Date().getFullYear()} {profile.name}</p>
    </section>
  );
}

export default function App() {
  const active = useActiveSection(sectionIds);
  useReveal();

  return (
    <div className="layout">
      <Profile active={active} />
      <main className="content">
        <About />
        <Experience />
        <Projects />
        <Education />
        <Skills />
        <Contact />
      </main>
    </div>
  );
}
