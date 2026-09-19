import React from 'react';

interface TechTag {
  name: string;
  color?: string;
}

interface ProjectLink {
  type: 'github' | 'demo' | 'paper';
  url: string;
  label: string;
}

interface Project {
  id: string;
  title: string;
  description: string;
  technologies: TechTag[];
  links: ProjectLink[];
  gradient: string;
}

interface HeroContent {
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
}

const LandingPage: React.FC = () => {
  const heroContent: HeroContent = {
    title: "Nick Fogg",
    subtitle: "Software Engineer & AI Specialist",
    description: "Specializing in machine learning, deep learning, and AI-driven solutions. I create scalable, production-ready systems that bridge the gap between cutting-edge research and practical applications.",
    ctaText: "View My Work",
    ctaLink: "#projects"
  };

  const projects: Project[] = [
    {
      id: "plant-care",
      title: "Plant Care",
      description: "A plant watering tracker that runs entirely on GitHub \u2014 no server, no database, no cron machine. Static site on Pages, data committed to the repo, and reminders sent by a scheduled Action or subscribed straight into a phone calendar. Works offline and installs to a home screen.",
      technologies: [
        { name: "Vanilla JS" },
        { name: "GitHub Actions" },
        { name: "Service Worker" },
        { name: "Python" }
      ],
      links: [
        { type: "demo", url: "https://nsfogg.github.io/plant_watering/", label: "Open the App" },
        { type: "github", url: "https://github.com/nsfogg/plant_watering", label: "Source Code" }
      ],
      gradient: "linear-gradient(135deg, #2f6d4f 0%, #7ec39a 100%)"
    },
    {
      id: "neural-optimizer",
      title: "Neural Architecture Optimizer",
      description: "Advanced AutoML system that automatically designs and optimizes neural network architectures using evolutionary algorithms and reinforcement learning. Achieved 15% improvement in model efficiency.",
      technologies: [
        { name: "PyTorch" },
        { name: "Ray" },
        { name: "Docker" },
        { name: "FastAPI" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "demo", url: "#", label: "Live Demo" },
        { type: "paper", url: "#", label: "Research Paper" }
      ],
      gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
    },
    {
      id: "realtime-ai",
      title: "Real-time AI Analytics Platform",
      description: "Distributed system processing 100K+ events per second with real-time ML inference. Features adaptive model retraining and anomaly detection with sub-millisecond latency.",
      technologies: [
        { name: "Kafka" },
        { name: "TensorFlow" },
        { name: "Redis" },
        { name: "React" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "demo", url: "#", label: "Dashboard Demo" }
      ],
      gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
    },
    {
      id: "vision-pipeline",
      title: "Computer Vision Pipeline",
      description: "Production-grade computer vision system for autonomous quality control in manufacturing. Implements custom attention mechanisms and achieves 99.7% accuracy in defect detection.",
      technologies: [
        { name: "OpenCV" },
        { name: "CUDA" },
        { name: "Python" },
        { name: "MLflow" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "demo", url: "#", label: "Case Study" }
      ],
      gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
    },
    {
      id: "nlp-framework",
      title: "Multi-modal NLP Framework",
      description: "Comprehensive framework combining text, audio, and visual data for content understanding. Supports 15+ languages with transformer-based architectures and custom tokenization.",
      technologies: [
        { name: "Transformers" },
        { name: "Hugging Face" },
        { name: "MongoDB" },
        { name: "GraphQL" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "demo", url: "#", label: "Interactive Demo" }
      ],
      gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
    },
    {
      id: "federated-learning",
      title: "Federated Learning System",
      description: "Privacy-preserving machine learning platform enabling collaborative model training across distributed datasets without data sharing. Implements differential privacy and secure aggregation.",
      technologies: [
        { name: "gRPC" },
        { name: "Kubernetes" },
        { name: "Go" },
        { name: "TensorFlow Federated" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "paper", url: "#", label: "Technical Report" }
      ],
      gradient: "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)"
    },
    {
      id: "ai-devtools",
      title: "AI Development Toolkit",
      description: "Open-source toolkit streamlining AI model development with automated data preprocessing, hyperparameter optimization, and model deployment. Reduces development time by 60%.",
      technologies: [
        { name: "Python" },
        { name: "Streamlit" },
        { name: "AWS" },
        { name: "Terraform" }
      ],
      links: [
        { type: "github", url: "#", label: "Source Code" },
        { type: "demo", url: "#", label: "Documentation" }
      ],
      gradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)"
    }
  ];

  const handleProjectClick = (project: Project) => {
    console.log(`Clicked on project: ${project.title}`);
  };

  const handleLinkClick = (e: React.MouseEvent, link: ProjectLink) => {
    e.stopPropagation();
    console.log(`Opening ${link.type}: ${link.url}`);
  };

  return (
    <div className="portfolio-landing">
      {/* Floating Background Elements */}
      <div className="floating-elements" aria-hidden="true">
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
        <div className="floating-shape"></div>
      </div>

      {/* Hero Section */}
      <section className="hero" id="hero" role="banner">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">{heroContent.title}</h1>
            <h2 className="hero-subtitle">{heroContent.subtitle}</h2>
            <p className="hero-description">{heroContent.description}</p>
            <a 
              href={heroContent.ctaLink} 
              className="cta-button"
              aria-label="Navigate to projects section"
            >
              <span>{heroContent.ctaText}</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 12l-4-4h8l-4 4z"/>
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Projects Section */}
      <section className="projects" id="projects" role="main">
        <div className="container">
          <h2 className="section-title">Featured Projects</h2>
          <p className="section-subtitle">
            Cutting-edge AI solutions built with modern technologies and deployed at scale
          </p>
          
          <div className="projects-grid">
            {projects.map((project) => (
              <article 
                key={project.id}
                className="project-card"
                onClick={() => handleProjectClick(project)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleProjectClick(project);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`View details for ${project.title}`}
              >
                <div className="scanning-line" aria-hidden="true"></div>
                
                <div 
                  className="project-image" 
                  style={{ background: project.gradient }}
                  role="img"
                  aria-label={`Preview image for ${project.title}`}
                >
                  {/* Gradient background serves as the visual element */}
                </div>
                
                <div className="project-content">
                  <h3 className="project-title">{project.title}</h3>
                  <p className="project-description">{project.description}</p>
                  
                  <div className="project-tech" role="list" aria-label="Technologies used">
                    {project.technologies.map((tech) => (
                      <span 
                        key={tech.name} 
                        className="tech-tag"
                        role="listitem"
                      >
                        {tech.name}
                      </span>
                    ))}
                  </div>
                  
                  <div className="project-links" role="navigation" aria-label="Project links">
                    {project.links.map((link) => (
                      <a
                        key={`${project.id}-${link.type}`}
                        href={link.url}
                        className="project-link"
                        onClick={(e) => handleLinkClick(e, link)}
                        aria-label={`${link.label} for ${project.title}`}
                        target={link.url.startsWith('#') ? '_self' : '_blank'}
                        rel={link.url.startsWith('#') ? '' : 'noopener noreferrer'}
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;