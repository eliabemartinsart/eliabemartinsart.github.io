const dialog = document.querySelector(".illustration-dialog");

if (typeof dialog?.showModal === "function") {
  const title = dialog.querySelector("h2");
  const stage = dialog.querySelector(".illustration-stage");
  const image = stage.querySelector("img");
  const count = dialog.querySelector("[data-illustration-count]");
  let items = [];
  let current = 0;
  let opener;

  function showImage(index) {
    current = (index + items.length) % items.length;
    const item = items[current];
    const thumbnail = item.querySelector("img");
    stage.classList.toggle("illustration-transparent", item.classList.contains("illustration-transparent"));
    image.alt = thumbnail.alt;
    image.src = item.href;
    count.textContent = `${current + 1} / ${items.length}`;
  }

  for (const project of document.querySelectorAll(".illustration-project")) {
    const gallery = [...project.querySelectorAll(".illustration-grid a")];
    gallery.forEach((item, index) => {
      item.addEventListener("click", (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        opener = item;
        items = gallery;
        title.textContent = project.querySelector("h3").textContent;
        showImage(index);
        dialog.showModal();
      });
    });
  }

  for (const control of dialog.querySelectorAll("[data-illustration-step]")) {
    control.addEventListener("click", () => showImage(current + Number(control.dataset.illustrationStep)));
  }

  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showImage(current + (event.key === "ArrowLeft" ? -1 : 1));
  });

  dialog.querySelector("[data-illustration-close]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    image.removeAttribute("src");
    opener?.focus({ preventScroll: true });
  });
}
