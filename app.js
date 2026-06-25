const state = {
  products: [],
  search: "",
  category: ""
};

const productsGrid = document.querySelector("#productsGrid");
const template = document.querySelector("#productTemplate");
const searchInput = document.querySelector("#searchInput");
const categoryFilter = document.querySelector("#categoryFilter");
const countLabel = document.querySelector("#countLabel");

async function loadCatalog() {
  const response = await fetch("data/catalogo-web.json", { cache: "no-store" });
  const catalog = await response.json();
  state.products = Array.isArray(catalog.products) ? catalog.products : [];
  buildCategories();
  renderProducts();
}

function buildCategories() {
  const categories = [...new Set(state.products.map(product => product.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  }
}

function renderProducts() {
  const search = normalize(state.search);
  const products = state.products.filter(product => {
    const matchesCategory = !state.category || product.category === state.category;
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

searchInput.addEventListener("input", event => {
  state.search = event.target.value;
  renderProducts();
});

categoryFilter.addEventListener("change", event => {
  state.category = event.target.value;
  renderProducts();
});

loadCatalog().catch(error => {
  productsGrid.textContent = "No se pudo cargar el catalogo.";
  console.error(error);
});