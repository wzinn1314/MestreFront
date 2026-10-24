(() => {
 const d=window.MDL;
 const $=(s,root=document)=>root.querySelector(s);
 const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  function localTime(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Recife", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(date);
    const value = (type) => parts.find((part) => part.type === type).value;
    return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday")), mins: Number(value("hour")) * 60 + Number(value("minute")) };
  }

  function isOpenNow() { return d.operatingConfig?.acceptingOrders === true; }
  function fillStatus() {
    const known=typeof d.operatingConfig?.acceptingOrders==='boolean',open=isOpenNow();
    $$('[data-status]').forEach(el=>{
      el.textContent=known?(open?'Loja aberta':'Loja fechada'):'Consultando loja…';
      el.classList.toggle('open',known && open);el.classList.toggle('closed',known && !open);
    });
  }

  function setupCarousel() {
    const root = $(".burger-carousel");
    if (!root) return;
    const photos = $$(".burger-photo", root);
    const dots = $$("[data-carousel-index]", root);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let index = 0;
    let paused = reducedMotion.matches;
    let hovered = false;
    let focused = false;
    let timer;
    function show(next) {
      index = (next + photos.length) % photos.length;
      photos.forEach((photo, i) => {
        photo.classList.toggle("active", i === index);
        photo.setAttribute("aria-hidden", String(i !== index));
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle("active", i === index);
        dot.setAttribute("aria-pressed", String(i === index));
      });
    }
    function schedule() {
      clearInterval(timer);
      if (!paused && !hovered && !focused && !document.hidden) timer = setInterval(() => show(index + 1), 1500);
    }
    $("[data-carousel-prev]", root).addEventListener("click", () => { show(index - 1); schedule(); });
    $("[data-carousel-next]", root).addEventListener("click", () => { show(index + 1); schedule(); });
    dots.forEach((dot, i) => dot.addEventListener("click", () => { show(i); schedule(); }));
    root.addEventListener("mouseenter", () => { hovered = true; schedule(); });
    root.addEventListener("mouseleave", () => { hovered = false; schedule(); });
    root.addEventListener("focusin", () => { focused = true; schedule(); });
    root.addEventListener("focusout", e => { focused = root.contains(e.relatedTarget); schedule(); });
    document.addEventListener("visibilitychange", schedule);
    reducedMotion.addEventListener("change", e => { paused = e.matches; schedule(); });
    show(0);
    schedule();
  }

 window.MDLTime = {localTime,isOpenNow,fillStatus};
 fillStatus();setupCarousel();setInterval(fillStatus,60000);
})();
