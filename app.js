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
const activeCategoryLabel = document.querySelector("#activeCategoryLabel");
const countLabel = document.querySelector("#countLabel");

async function loadCatalog() {
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
    .sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, "es"));
}

function renderDesktopCategories() {
  desktopCategories.replaceChildren(createAllCategoriesItem(), ...childrenOf(null).map(category => createDesktopCategory(category)));
}

function createAllCategoriesItem() {
  const item = document.createElement("div");
  item.className = `category-item all-categories${state.categoryId === null ? " active" : ""}`;
  item.textContent = "Todos";
  item.addEventListener("click", event => {
    event.stopPropagation();
    selectCategory(null);
  });
  return item;
}

function createDesktopCategory(category) {
  const children = childrenOf(category.id);
  const item = document.createElement("div");
  item.className = `category-item${children.length ? " has-children" : ""}${state.categoryId === category.id ? " active" : ""}`;
  item.textContent = category.name;
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
  mobileCategories.replaceChildren(createAllMobileCategoriesItem(), ...childrenOf(null).map(category => createMobileCategory(category)));
}

function createAllMobileCategoriesItem() {
  const item = document.createElement("div");
  item.className = "mobile-category";
  const button = document.createElement("button");
  button.className = `mobile-category-button${state.categoryId === null ? " active" : ""}`;
  button.type = "button";
  button.innerHTML = "<span>Todos</span><span></span>";
  button.addEventListener("click", () => {
    selectCategory(null);
  });
  item.appendChild(button);
  return item;
}

function createMobileCategory(category) {
  const children = childrenOf(category.id);
  const item = document.createElement("div");
  item.className = "mobile-category";

  const button = document.createElement("button");
  button.className = `mobile-category-button${state.categoryId === category.id ? " active" : ""}`;
  button.type = "button";
  button.innerHTML = `<span>${escapeHtml(category.name)}</span><span>${children.length ? "+" : ""}</span>`;
  button.addEventListener("click", () => {
    selectCategory(category.id);
    if (children.length) item.classList.toggle("expanded");
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
  countLabel.textContent = `${products.length} productos`;
  activeCategoryLabel.textContent = state.categoryId
    ? state.categories.find(category => category.id === state.categoryId)?.name || "Categoria"
    : "Todos";

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
      if (category.parentId !== null && ids.has(category.parentId) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}

function selectCategory(categoryId) {
  state.categoryId = categoryId;
  closeMobilePanel();
  renderDesktopCategories();
  renderMobileCategories();
  renderProducts();
}

function renderImage(container, product) {
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
  if (product.price === null || product.price === undefined || product.price === "") {
    container.remove();
    return;
  }

  container.textContent = `${product.currency || ""} ${product.price}`.trim();
}

function renderAttributes(container, attributes) {
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

searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  renderProducts();
});

function openMobilePanel() {
  mobileOverlay.hidden = false;
  mobilePanel.hidden = false;
}

function closeMobilePanel() {
  mobileOverlay.hidden = true;
  mobilePanel.hidden = true;
}

mobileCategoriesButton.addEventListener("click", openMobilePanel);
closeMobileCategoriesButton.addEventListener("click", closeMobilePanel);
mobileOverlay.addEventListener("click", closeMobilePanel);

loadCatalog().catch(error => {
  productsGrid.textContent = "No se pudo cargar el catalogo: " + error.message;
  console.error(error);
});