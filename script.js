(() => {
  "use strict";

  const projects = {
    babacu: {
      title: "Babaçu",
      category: "Animação 2D",
      year: "2024—2026",
      role: "Animador 2D e artista de VFX",
      function: "Animação cut-out e frame a frame; VFX do elemento fogo",
      production: "Muirak Studio",
      description:
        "Curta de aventura e fantasia ambientado em uma Belém encantada. Eliabe atuou em animação cut-out e frame a frame, além dos efeitos visuais do elemento fogo.",
      image: "./assets/covers/babacu.webp",
      alt: "Cena do projeto de animação Babaçu",
      link: "https://muirak.com/projetos-autorais/projeto-baba%C3%A7u.html",
      linkLabel: "Conhecer o projeto",
      portrait: false,
    },
    "menino-toquinho": {
      title: "Menino Toquinho",
      category: "Animação 2D",
      year: "2024",
      role: "Animador 2D e animador VFX",
      function: "Animação de cenas e VFX do elemento fogo",
      production: "Muirak Studio / Búfalos TV / Warner Bros.",
      description:
        "Trabalho realizado como integrante da equipe de animação da Muirak Studio, com animação 2D de cenas e efeitos visuais do elemento fogo.",
      image: "./assets/covers/menino-toquinho.jpg",
      alt: "Cena de Menino Toquinho",
      link: "https://www.youtube.com/watch?v=91d01xD2i7A",
      linkLabel: "Assistir ao projeto",
      portrait: false,
    },
    "mundo-das-cores": {
      title: "Mundo das Cores",
      category: "Animação 2D",
      year: "2024",
      role: "Animador 2D",
      function: "Animação e criação de rigs de props",
      production: "Muirak Studio",
      description:
        "Série infantil musical protagonizada por personagens multiformes. Eliabe participou da produção de animação 2D e criou rigs de objetos usados nas cenas.",
      image: "./assets/covers/mundo-das-cores.webp",
      alt: "Cena do projeto Mundo das Cores",
      link: "https://muirak.com/projetos-autorais/projeto-mundo-das-cores.html",
      linkLabel: "Conhecer o projeto",
      portrait: false,
    },
    "caminho-deserto": {
      title: "Caminho Deserto",
      category: "Animação 2D",
      year: "2024—2025",
      role: "Animador 2D e artista de cenários",
      function: "Animação frame a frame e arte de cenários",
      production: "Pós-graduação em Animação 2D da Méliès",
      description:
        "Projeto desenvolvido no contexto da pós-graduação em Animação 2D da Méliès, com atuação em animação frame a frame e criação de cenários.",
      image: "./assets/covers/caminho-deserto.jpg",
      alt: "Cena da animação Caminho Deserto",
      link: "https://www.youtube.com/watch?v=u6c-n8CChHw",
      linkLabel: "Assistir ao projeto",
      portrait: false,
    },
    "uma-nova-luz": {
      title: "Uma Nova Luz",
      category: "Documentário narrativo",
      year: "2025",
      role: "Diretor, roteirista e animador",
      function: "Direção, roteiro, pós-produção, edição, animação e storyboard",
      production: "Festival Alunos que Inspiram — FAQI",
      description:
        "Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2025.",
      image: "./assets/covers/uma-nova-luz.jpg",
      alt: "Cena do curta Uma Nova Luz: A Arte da Reciclagem de Ideias",
      link: "https://youtu.be/rYfqIQjrDZI?si=gAroUOVr_0E_SImB",
      linkLabel: "Assistir ao curta",
      portrait: false,
    },
    escuta: {
      title: "Escuta",
      category: "Documentário narrativo",
      year: "2026",
      role: "Diretor, roteirista e animador",
      function: "Direção, roteiro, pós-produção, edição, animação e storyboard",
      production: "Festival Alunos que Inspiram — FAQI",
      description:
        "Documentário narrativo autoral desenvolvido para o Festival Alunos que Inspiram. O projeto venceu a etapa regional do festival em 2026.",
      image: "./assets/covers/escuta.jpg",
      alt: "Cena do curta-metragem Escuta",
      link: "https://www.youtube.com/watch?v=tfWpcs5rXh8",
      linkLabel: "Assistir ao curta",
      portrait: false,
    },
    "crianca-telas": {
      title: "A Criança Presa no Mundo das Telas",
      category: "Ilustração editorial",
      year: "2024",
      role: "Ilustrador, line artist e colorista",
      function: "Colorização, ilustrações e line art",
      production: "Autora: Elis Nunes",
      description:
        "Livro infantil sobre Luca, um menino que redescobre experiências, talentos, amizades e a conexão com a natureza para além das telas.",
      image: "./assets/covers/crianca-telas.webp",
      alt: "Capa do livro A Criança Presa no Mundo das Telas",
      link: "https://bibliotecamundial.com.br/a-crianca-presa-no-mundo-das-telas-the-child-trapped-in-the-screens-elis-nunes/",
      linkLabel: "Ver publicação",
      portrait: true,
    },
    "atos-amor": {
      title: "A Criança que Fazia Muitos Atos de Amor",
      category: "Ilustração editorial",
      year: "2024",
      role: "Ilustrador, line artist e colorista",
      function: "Colorização, ilustrações e line art",
      production: "Autora: Maitê Nunes",
      description:
        "Livro infantil sobre empatia, solidariedade e pequenos gestos capazes de transformar a escola, a família e a comunidade.",
      image: "./assets/covers/atos-amor.webp",
      alt: "Capa do livro A Criança que Fazia Muitos Atos de Amor",
      link: "https://bibliotecamundial.com.br/a-crianca-que-fazia-muitos-atos-de-amor-maite-nunes/",
      linkLabel: "Ver publicação",
      portrait: true,
    },
    "criancas-rio": {
      title: "As Crianças que Salvaram o Rio",
      category: "Ilustração editorial",
      year: "2025",
      role: "Ilustrador, line artist e colorista",
      function: "Colorização, ilustrações e line art",
      production: "Autoras: Elis Nunes e Maitê Nunes",
      description:
        "Obra infantil que retrata a vida nas comunidades ribeirinhas e apresenta o uso responsável dos recursos naturais por meio de uma aventura ilustrada.",
      image: "./assets/covers/criancas-rio.jpeg",
      alt: "Capa do livro As Crianças que Salvaram o Rio",
      link: "https://www.magazineluiza.com.br/as-criancas-que-salvarm-o-rio-the-children-who-the-river-nacional/p/cjd7a4fddf/li/ldic/?seller_id=livrariagraopara",
      linkLabel: "Ver publicação",
      portrait: true,
    },
  };

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector("[data-header]");
  const progress = document.querySelector(".scroll-progress span");
  const menuToggle = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");
  const dialog = document.querySelector("#project-dialog");
  const dialogMedia = dialog?.querySelector(".dialog-media");
  let lastFocusedElement = null;

  const updateScrollState = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(scrollTop / scrollable, 1) : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    header?.classList.toggle("is-scrolled", scrollTop > 24);
  };

  updateScrollState();
  window.addEventListener("scroll", updateScrollState, { passive: true });

  const setMenuOpen = (open) => {
    if (!menuToggle || !navigation) return;
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    navigation.classList.toggle("is-open", open);
    document.body.classList.toggle("dialog-open", open);
  };

  menuToggle?.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
  });

  navigation?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  const revealItems = document.querySelectorAll(".reveal:not(.is-visible)");
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.11, rootMargin: "0px 0px -40px" },
    );
    revealItems.forEach((item) => revealObserver.observe(item));
  }

  const slides = [...document.querySelectorAll("[data-slide]")];
  const slideDots = [...document.querySelectorAll("[data-slide-dot]")];
  const slideCount = document.querySelector("[data-slide-count]");
  const nextSlideButton = document.querySelector("[data-slide-next]");
  const heroPlayLink = document.querySelector("[data-hero-play]");
  const heroFrame = document.querySelector("[data-hero-frame]");
  let currentSlide = 0;
  let slideTimer;

  const showSlide = (index) => {
    if (!slides.length) return;
    currentSlide = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === currentSlide));
    slideDots.forEach((dot, dotIndex) => {
      const isActive = dotIndex === currentSlide;
      dot.classList.toggle("is-active", isActive);
      dot.setAttribute("aria-current", isActive ? "true" : "false");
    });
    if (slideCount) slideCount.textContent = `${String(currentSlide + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`;
    if (heroPlayLink) {
      const activeSlide = slides[currentSlide];
      heroPlayLink.href = activeSlide.dataset.projectLink;
      heroPlayLink.textContent = activeSlide.dataset.actionLabel || "PLAY!";
      heroPlayLink.setAttribute("aria-label", activeSlide.dataset.actionDescription || `Abrir ${activeSlide.dataset.projectTitle}`);
    }
  };

  const startSlideTimer = () => {
    if (prefersReducedMotion || slides.length < 2) return;
    window.clearInterval(slideTimer);
    slideTimer = window.setInterval(() => showSlide(currentSlide + 1), 5200);
  };

  nextSlideButton?.addEventListener("click", () => {
    showSlide(currentSlide + 1);
    startSlideTimer();
  });
  slideDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slideDot));
      startSlideTimer();
    });
  });
  heroFrame?.addEventListener("mouseenter", () => window.clearInterval(slideTimer));
  heroFrame?.addEventListener("mouseleave", startSlideTimer);
  showSlide(0);
  startSlideTimer();

  const filterButtons = document.querySelectorAll("[data-filter]");
  const projectCards = document.querySelectorAll("[data-project]");
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      filterButtons.forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("is-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      projectCards.forEach((card) => {
        const visible = filter === "todos" || card.dataset.category.split(/\s+/).includes(filter);
        card.classList.toggle("is-hidden", !visible);
      });
    });
  });

  if (!prefersReducedMotion && window.matchMedia("(pointer: fine)").matches) {
    projectCards.forEach((card) => {
      card.addEventListener("pointermove", (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--ry", `${x * 4.5}deg`);
        card.style.setProperty("--rx", `${y * -4.5}deg`);
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    });
  }

  const dialogFields = {
    image: dialog?.querySelector("[data-dialog-image]"),
    category: dialog?.querySelector("[data-dialog-category]"),
    year: dialog?.querySelector("[data-dialog-year]"),
    title: dialog?.querySelector("[data-dialog-title]"),
    role: dialog?.querySelector("[data-dialog-role]"),
    description: dialog?.querySelector("[data-dialog-description]"),
    function: dialog?.querySelector("[data-dialog-function]"),
    production: dialog?.querySelector("[data-dialog-production]"),
    link: dialog?.querySelector("[data-dialog-link]"),
  };

  const openProject = (projectId, opener = null) => {
    const project = projects[projectId];
    if (!project || !dialog) return;
    lastFocusedElement = opener || document.activeElement;
    dialogFields.image.src = project.image;
    dialogFields.image.alt = project.alt;
    dialogFields.category.textContent = project.category;
    dialogFields.year.textContent = project.year;
    dialogFields.title.textContent = project.title;
    dialogFields.role.textContent = project.role;
    dialogFields.description.textContent = project.description;
    dialogFields.function.textContent = project.function;
    dialogFields.production.textContent = project.production;
    dialogFields.link.href = project.link;
    dialogFields.link.firstChild.textContent = `${project.linkLabel} `;
    dialogMedia?.classList.toggle("is-portrait", project.portrait);
    dialog.classList.toggle("has-long-title", project.title.length > 25);
    dialog.classList.toggle("has-extra-long-title", project.title.length > 38);
    dialog.showModal();
    document.body.classList.add("dialog-open");
  };

  projectCards.forEach((card) => {
    card.addEventListener("click", () => openProject(card.dataset.project, card));
  });

  document.querySelectorAll("[data-project-jump]").forEach((button) => {
    button.addEventListener("click", () => openProject(button.dataset.projectJump, button));
  });

  const closeDialog = () => {
    if (!dialog?.open) return;
    dialog.close();
  };

  dialog?.querySelector("[data-dialog-close]")?.addEventListener("click", closeDialog);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog?.addEventListener("close", () => {
    document.body.classList.remove("dialog-open");
    lastFocusedElement?.focus?.();
  });

  const currentYear = new Date().getFullYear();
  document.querySelectorAll("[data-auto-years]").forEach((element) => {
    const baseYear = Number(element.dataset.baseYear);
    const baseValue = Number(element.dataset.baseValue);
    if (!Number.isFinite(baseYear) || !Number.isFinite(baseValue)) return;

    const automaticValue = Math.max(0, baseValue + currentYear - baseYear);
    element.textContent = String(automaticValue);
    if (element.hasAttribute("data-count")) {
      element.dataset.count = String(automaticValue);
    }
  });

  const counters = document.querySelectorAll("[data-count]");
  if (!prefersReducedMotion && "IntersectionObserver" in window) {
    counters.forEach((counter) => {
      const target = Number(counter.dataset.count);
      counter.textContent = "0";
      const countObserver = new IntersectionObserver(
        ([entry], observer) => {
          if (!entry.isIntersecting) return;
          const start = performance.now();
          const duration = 900;
          const tick = (now) => {
            const progressValue = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progressValue, 3);
            counter.textContent = String(Math.round(target * eased));
            if (progressValue < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        },
        { threshold: 0.7 },
      );
      countObserver.observe(counter);
    });
  }

  const yearTarget = document.querySelector("[data-current-year]");
  if (yearTarget) yearTarget.textContent = String(currentYear);
})();
