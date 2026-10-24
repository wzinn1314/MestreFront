(() => {
  const d = window.MDL;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function renderHours() {
    const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const today = window.MDLTime.localTime().day;
    const ul = $("#hours");
    if (!ul) return;
    ul.innerHTML = days
      .map((name, i) => {
        const closed = i === 0 && d.horario.fechaDomingo;
        const range = closed ? "Fechado" : `${d.horario.abre} – ${d.horario.fecha}`;
        return `<li class="${i === today ? "today" : ""}"><span>${name}${i === today ? " · hoje" : ""}</span><strong>${range}</strong></li>`;
      })
      .join("");
  }

  function setupNav() {
    const slides = $$(".slide");
    const dots = $("#dots");
    slides.forEach((slide, i) => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", "Ir para " + slide.dataset.title);
      btn.addEventListener("click", () => slide.scrollIntoView({ behavior: "smooth" }));
      if (i === 0) btn.classList.add("active");
      dots.appendChild(btn);
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          $$(".nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
          const idx = slides.indexOf(entry.target);
          $$("#dots button").forEach((b, i) => b.classList.toggle("active", i === idx));
        });
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
    );
    slides.forEach((s) => io.observe(s));

    window.addEventListener("scroll", () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      $("#progress").style.width = (max ? (window.scrollY / max) * 100 : 0) + "%";
    });

  }


  renderHours();
  setupNav();
})();
