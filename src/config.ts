export const siteConfig = {
  name: "Jonathan Zhao",
  title: "Software Engineer · Backend, Full-Stack & Applied AI",
  description:
    "Portfolio of Jonathan Zhao — MIT Computer Science & Engineering '26. Backend, full-stack, and applied-AI engineer.",
  accentColor: "#2563eb",
  social: {
    email: "jonnnny80@gmail.com",
    linkedin: "https://linkedin.com/in/joezhao888",
    twitter: "",
    github: "https://github.com/saloushe",
    resume: "/JonathanZhaoSep2026.pdf",
  },
  aboutMe:
    "I'm a Computer Science & Engineering new grad from MIT (June 2026) who likes building systems from the ground up — databases, ML internals, and full-stack products — where the hard part is the engineering, not the wrapper. I built a relational database engine in Go (GoDB) with Strong Strict 2PL transactions and ARIES-style crash recovery, probed model internals by fine-tuning BERT and causally testing the features it learns through ablation, and shipped production Python at the Simons Electron Microscopy Center and Duet. I'm looking for new-grad software engineering roles — open to NYC and remote, and happy to relocate for the right team.",
  skills: [
    "Go",
    "Python",
    "TypeScript",
    "JavaScript",
    "C",
    "Assembly",
    "React",
    "Node.js",
    "Express",
    "MongoDB",
    "Socket.io",
    "PyTorch",
    "scikit-learn",
    "HuggingFace",
    "AWS",
    "SQL",
  ],
  projects: [
    {
      name: "GoDB — Relational Database Engine (Go)",
      description:
        "A relational database engine built from scratch across four labs: heap-file storage, a concurrent CAS-based buffer pool, and a Volcano-style execution engine with four join algorithms (hash, sort-merge, block nested-loop, index nested-loop), grouped aggregation, and full CRUD executors. Implements Strong Strict 2PL with multi-granularity table/tuple locking and wait-for-graph deadlock detection, a rule-based query optimizer (predicate pushdown, priority-ranked physical plan selection), and ARIES-style crash recovery — a checksummed write-ahead log with torn-write detection, a double-buffered log manager enabling group commit, and Analysis/Redo/Undo recovery with fuzzy checkpointing.",
      link: "",
      skills: ["Go", "Databases", "Transactions", "Crash Recovery"],
    },
    {
      name: "WaitLess — Real-Time Nightlife Crowdsourcing",
      description:
        "Full-stack venue crowdsourcing platform (React, Node.js/Express, MongoDB) with Socket.io real-time updates and configurable alert subscriptions triggered by user-defined wait-time and crowd conditions. Geospatial indexing powers location-aware queries, and background snapshots aggregate crowd stats for peak-time forecasting.",
      link: "https://github.com/saloushe/waitless",
      skills: ["React", "Node.js", "MongoDB", "Socket.io"],
    },
    {
      name: "Why Transformers Miss Toxicity — NLP Interpretability",
      description:
        "Fine-tuned BERT on 322K+ examples across three toxicity corpora (90.5% accuracy, 0.76 F1), then trained a 128-unit autoencoder over final-layer CLS embeddings to surface toxicity-correlated features (Pearson r = 0.87). Causally tested those features through feature and attention-head ablation, finding the representation redundant rather than localized.",
      link: "",
      skills: ["Python", "PyTorch", "BERT", "Interpretability"],
    },
  ],
  experience: [
    {
      company: "Simons Electron Microscopy Center",
      title: "Software Engineering Intern",
      dateRange: "May 2025 – Aug 2025",
      bullets: [
        "Designed Cryo-Insight, a Python library enabling Leginon users to convert cryo-EM datasets into the EMinsight schema for downstream analysis workflows.",
        "Extended EMinsight with additional data-aggregation, reporting, and visualization features.",
      ],
    },
    {
      company: "Duet",
      title: "Backend Engineer Intern",
      dateRange: "Nov 2024 – Feb 2025",
      bullets: [
        "Built a MusicXML parsing and analysis pipeline in Python (from-scratch and music21-based implementations), extracting structural score data — parts, measures, barlines, repeats, time signatures — plus segmentation utilities for an AI-based sheet-music-writing copilot.",
      ],
    },
    {
      company: "MIT Media Lab — MIT Game Lab",
      title: "Undergraduate Researcher",
      dateRange: "Oct 2022 – June 2023",
      bullets: [
        "Designed player-facing ARG puzzles teaching DEI principles to high-school students, blending physical puzzle mechanics with a virtual presentation layer.",
      ],
    },
    {
      company: "Feil Family Brain & Mind Research Institute",
      title: "Researcher, Gang Wang Lab",
      dateRange: "Apr 2019 – Nov 2021",
      bullets: [
        "Researched voltage-gated L-type calcium channels in neuropsychiatric disorders in early-stage Alzheimer's Disease; co-discovered the role of L-type channels and amygdala NPY neurons in anxiety-related behaviors.",
      ],
    },
  ],
  education: [
    {
      school: "Massachusetts Institute of Technology (MIT)",
      degree: "B.S. in Computer Science and Engineering",
      dateRange: "2022 – 2026",
      achievements: [
        "Coursework: Computer Systems Engineering, Operating Systems Engineering, Database Systems, Design & Analysis of Algorithms, Programming in C and Assembly, Software Design, Natural Language Processing, AI, Decision Making & Society",
      ],
    },
  ],
};