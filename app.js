const state = {
  categories: [],
  products: [],
  search: "",
  categoryId: null
};

const productsGrid = document.querySelector("#productsGrid");
const template = document.querySelector("#productTemplate");
const searchInput = document.querySelector("#searchInput");
const desktopCategories = document.querySelector("#desktopCategories");
const mobileCategories = document.querySelector("#mobileCategories");
const mobilePanel = document.querySelector("#mobileCategoriesPanel");
const mobileOverlay = document.querySelector("#mobileOverlay");
const mobileCategoriesButton = document.querySelector("#mobileCategoriesButton");
const closeMobileCategoriesButton = document.querySelector("#closeMobileCategoriesButton");
const clearFiltersButton = document.querySelector("#clearFiltersButton");
const activeCategoryLabel = document.querySelector("#activeCategoryLabel");
const countLabel = document.querySelector("#countLabel");

async function loadCatalog() {
  // En GitHub Pages deberia estar en /data/catalogo-web.json.
  // Dejo tambien una segunda opcion por si se prueba localmente con el JSON al lado del index.html.
  let response = await fetch("data/catalogo-web.json", { cache: "no-store" });
  if (!response.ok) {
    response = await fetch("catalogo-web.json", { cache: "no-store" });
  }
  if (!response.ok) {
    throw new Error(`No se encontro catalogo-web.json. Estado HTTP: ${response.status}`);
  }

  const catalog = await response.json();
  state.categories = Array.isArray(catalog.categories) ? catalog.categories : [];
  state.products = Array.isArray(catalog.products) ? catalog.products : [];

  renderDesktopCategories();
  renderMobileCategories();
  renderProducts();
}

function childrenOf(parentId) {
  return state.categories
    .filter(category => (category.parentId ?? null) === (parentId ?? null))
    .sort((a, b) =>
      ((a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)) ||
      String(a.name || "").localeCompare(String(b.name || ""), "es")
    );
}

function renderDesktopCategories() {
  if (!desktopCategories) return;
  desktopCategories.replaceChildren(...childrenOf(null).map(category => createDesktopCategory(category)));
}

function createDesktopCategory(category) {
  const children = childrenOf(category.id);
  const item = document.createElement("div");
  item.className = `category-item${children.length ? " has-children" : ""}`;
  item.textContent = category.name || "Categoria";
  item.dataset.id = category.id;
  item.addEventListener("click", event => {
    event.stopPropagation();
    selectCategory(category.id);
  });

  if (children.length) {
    const submenu = document.createElement("div");
    submenu.className = "submenu";
    submenu.append(...children.map(child => createDesktopCategory(child)));
    item.appendChild(submenu);
  }

  return item;
}

function renderMobileCategories() {
  if (!mobileCategories) return;
  mobileCategories.replaceChildren(...childrenOf(null).map(category => createMobileCategory(category)));
}

function createMobileCategory(category) {
  const children = childrenOf(category.id);
  const item = document.createElement("div");
  item.className = "mobile-category";

  const button = document.createElement("button");
  button.className = "mobile-category-button";
  button.type = "button";
  button.innerHTML = `<span>${escapeHtml(category.name || "Categoria")}</span><span>${children.length ? "+" : ""}</span>`;
  button.addEventListener("click", event => {
    event.stopPropagation();
    if (children.length) {
      item.classList.toggle("expanded");
    } else {
      selectCategory(category.id);
      closeMobilePanel();
    }
  });
  item.appendChild(button);

  if (children.length) {
    const childBox = document.createElement("div");
    childBox.className = "mobile-children";
    childBox.append(...children.map(child => createMobileCategory(child)));
    item.appendChild(childBox);
  }

  return item;
}

function renderProducts() {
  if (!productsGrid || !template) return;

  const search = normalize(state.search);
  const allowedCategoryIds = state.categoryId ? descendantIds(state.categoryId) : null;
  const products = state.products.filter(product => {
    const productCategoryIds = Array.isArray(product.categoryIds) ? product.categoryIds : [];
    const matchesCategory = !allowedCategoryIds ||
      productCategoryIds.some(id => allowedCategoryIds.has(id));
    const text = normalize([
      product.sku,
      product.title,
      product.description,
      product.category,
      ...Object.values(product.attributes || {})
    ].join(" "));
    return matchesCategory && (!search || text.includes(search));
  });

  productsGrid.replaceChildren();

  if (countLabel) countLabel.textContent = `${products.length} productos`;
  if (activeCategoryLabel) {
    activeCategoryLabel.textContent = state.categoryId
      ? state.categories.find(category => category.id === state.categoryId)?.name || "Categoria"
      : "Todas las categorias";
  }

  for (const product of products) {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".sku").textContent = product.sku || "";
    node.querySelector("h2").textContent = product.title || "";
    node.querySelector(".description").textContent = product.description || "";
    renderImage(node.querySelector(".product-image"), product);
    renderPrice(node.querySelector(".price"), product);
    renderAttributes(node.querySelector(".attributes"), product.attributes || {});
    productsGrid.appendChild(node);
  }
}

function descendantIds(categoryId) {
  const ids = new Set([categoryId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of state.categories) {
      if ((category.parentId ?? null) !== null && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}

function selectCategory(categoryId) {
  state.categoryId = categoryId;
  renderProducts();
}

function renderImage(container, product) {
  if (!container) return;
  if (!product.image) {
    container.textContent = "Sin imagen";
    return;
  }

  const image = document.createElement("img");
  image.src = product.image;
  image.alt = product.title || product.sku || "Producto";
  container.appendChild(image);
}

function renderPrice(container, product) {
  if (!container) return;
  if (product.price === null || product.price === undefined || product.price === "") {
    container.remove();
    return;
  }

  container.textContent = `${product.currency || ""} ${product.price}`.trim();
}

function renderAttributes(container, attributes) {
  if (!container) return;
  for (const [name, value] of Object.entries(attributes)) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = name;
    description.textContent = value;
    container.append(term, description);
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function openMobilePanel() {
  if (mobileOverlay) mobileOverlay.hidden = false;
  if (mobilePanel) mobilePanel.hidden = false;
}

function closeMobilePanel() {
  if (mobileOverlay) mobileOverlay.hidden = true;
  if (mobilePanel) mobilePanel.hidden = true;
}

if (searchInput) {
  searchInput.addEventListener("input", event => {
    state.search = event.target.value;
    renderProducts();
  });
}

if (clearFiltersButton) {
  clearFiltersButton.addEventListener("click", () => {
    state.search = "";
    state.categoryId = null;
    if (searchInput) searchInput.value = "";
    closeMobilePanel();
    renderProducts();
  });
}

if (mobileCategoriesButton) {
  mobileCategoriesButton.addEventListener("click", openMobilePanel);
}

if (closeMobileCategoriesButton) {
  closeMobileCategoriesButton.addEventListener("click", closeMobilePanel);
}

if (mobileOverlay) {
  mobileOverlay.addEventListener("click", closeMobilePanel);
}

loadCatalog().catch(error => {
  if (productsGrid) {
    productsGrid.textContent = "No se pudo cargar el catalogo: " + error.message;
  }
  console.error(error);
});
