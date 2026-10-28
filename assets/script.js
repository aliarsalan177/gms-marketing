// Minimal enhancement: smooth-scroll for anchor clicks in the header
// (browsers already do this via scroll-behavior:smooth CSS but this
// also updates the focused element for keyboard nav) and a subtle
// active-link highlight for the current section on scroll.

(function () {
  const links = document.querySelectorAll('.nav-links a[href^="#"]');
  const sections = Array.from(links)
    .map((a) => a.getAttribute("href"))
    .filter((h) => h && h.startsWith("#") && h !== "#")
    .map((h) => document.querySelector(h))
    .filter(Boolean);

  if (!sections.length || !("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = "#" + e.target.id;
        links.forEach((a) => {
          if (a.getAttribute("href") === id) {
            a.style.color = "var(--text)";
          } else {
            a.style.color = "";
          }
        });
      });
    },
    { rootMargin: "-40% 0px -55% 0px" },
  );
  sections.forEach((s) => io.observe(s));
})();
