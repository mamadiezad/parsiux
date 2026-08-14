const filters = [...document.querySelectorAll(".filter")];
const cards = [...document.querySelectorAll(".pattern-card")];

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filters.forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    cards.forEach((card) => card.classList.toggle("is-hidden", filter !== "all" && card.dataset.kind !== filter));
  });
});
