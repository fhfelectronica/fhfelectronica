const state = {
  categories: [],
  products: [],
  search: "",
  categoryId: null,
  mediaVersion: "",
  ordering: {},
  cart: new Map(),
  turnstileWidgetId: null
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
const contactLinks = document.querySelector("#contactLinks");
const cartButton = document.querySelector("#cartButton");
const cartCount = document.querySelector("#cartCount");
const orderDialog = document.querySelector("#orderDialog");
const orderForm = document.querySelector("#orderForm");
const orderItems = document.querySelector("#orderItems");
const closeOrderButton = document.querySelector("#closeOrderButton");
const submitOrderButton = document.querySelector("#submitOrderButton");
const orderMessage = document.querySelector("#orderMessage");

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
  state.mediaVersion = encodeURIComponent(catalog.generatedAt || Date.now());
  state.ordering = catalog.ordering || {};
  renderContactLinks();
  configureOrdering();
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
    configureProductOrderControls(node.querySelector(".order-controls"), product);
    productsGrid.appendChild(node);
  }
}

function renderContactLinks() {
  contactLinks.replaceChildren();
  const whatsapp = String(state.ordering.whatsApp || "").replace(/\D/g, "");
  const email = String(state.ordering.email || "").trim();
  if (whatsapp) {
    const link = document.createElement("a");
    link.className = "contact-link";
    link.href = `https://wa.me/${whatsapp}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "WhatsApp";
    contactLinks.appendChild(link);
  }
  if (email) {
    const link = document.createElement("a");
    link.className = "contact-link";
    link.href = `mailto:${email}`;
    link.textContent = "Correo";
    contactLinks.appendChild(link);
  }
}

function configureOrdering() {
  const enabled = state.ordering.enabled === true && Boolean(state.ordering.apiUrl);
  cartButton.hidden = !enabled;
  if (enabled && state.ordering.turnstileSiteKey) loadTurnstileScript();
  updateCartButton();
}

function configureProductOrderControls(container, product) {
  if (state.ordering.enabled !== true || !state.ordering.apiUrl) {
    container.remove();
    return;
  }
  const quantityInput = container.querySelector(".quantity-input");
  const addButton = container.querySelector(".add-to-order");
  addButton.addEventListener("click", () => {
    const quantity = readQuantity(quantityInput.value);
    if (!quantity) {
      quantityInput.focus();
      return;
    }
    const sku = String(product.sku || "").trim();
    if (!sku) return;
    const previous = state.cart.get(sku);
    state.cart.set(sku, {
      sku,
      internalCode: product.internalCode || sku,
      title: product.title || sku,
      quantity: Math.min((previous?.quantity || 0) + quantity, 999999)
    });
    quantityInput.value = "1";
    addButton.textContent = "Agregado";
    setTimeout(() => addButton.textContent = "Agregar a cotización", 900);
    updateCartButton();
  });
}

function readQuantity(value) {
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 999999 ? quantity : 0;
}

function updateCartButton() {
  cartCount.textContent = String([...state.cart.values()].reduce((sum, item) => sum + item.quantity, 0));
}

function openOrderDialog() {
  renderOrderItems();
  orderMessage.textContent = "";
  orderMessage.className = "order-message";
  orderDialog.showModal();
  renderTurnstile();
}

function renderOrderItems() {
  orderItems.replaceChildren();
  if (!state.cart.size) {
    const empty = document.createElement("p");
    empty.textContent = "Todavia no agregaste productos.";
    orderItems.appendChild(empty);
    submitOrderButton.disabled = true;
    return;
  }
  submitOrderButton.disabled = false;
  for (const item of state.cart.values()) {
    const row = document.createElement("div");
    row.className = "order-item";
    const sku = document.createElement("div");
    sku.className = "order-item-sku";
    sku.textContent = item.sku;
    const title = document.createElement("div");
    title.textContent = item.title;
    const quantity = document.createElement("input");
    quantity.className = "quantity-input";
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = "999999";
    quantity.value = String(item.quantity);
    quantity.addEventListener("change", () => {
      const value = readQuantity(quantity.value);
      if (!value) {
        quantity.value = String(item.quantity);
        return;
      }
      item.quantity = value;
      updateCartButton();
    });
    const remove = document.createElement("button");
    remove.className = "remove-order-item";
    remove.type = "button";
    remove.textContent = "Quitar";
    remove.addEventListener("click", () => {
      state.cart.delete(item.sku);
      updateCartButton();
      renderOrderItems();
    });
    row.append(sku, title, quantity, remove);
    orderItems.appendChild(row);
  }
}

async function submitOrder(event) {
  event.preventDefault();
  if (!state.cart.size) return;
  const customer = {
    name: document.querySelector("#customerName").value.trim(),
    phone: document.querySelector("#customerPhone").value.trim(),
    email: document.querySelector("#customerEmail").value.trim(),
    taxId: document.querySelector("#customerTaxId").value.trim(),
    location: document.querySelector("#customerLocation").value.trim(),
    notes: document.querySelector("#customerNotes").value.trim()
  };
  if (!Object.values(customer).some(Boolean)) {
    showOrderMessage("Completa al menos un dato para que podamos identificarte.");
    return;
  }

  const turnstileToken = getTurnstileToken();
  if (state.ordering.turnstileSiteKey && !turnstileToken) {
    showOrderMessage("Completa la verificacion antispam.");
    return;
  }

  submitOrderButton.disabled = true;
  submitOrderButton.textContent = "Enviando...";
  showOrderMessage("");
  try {
    const response = await fetch(`${String(state.ordering.apiUrl).replace(/\/$/, "")}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customer, items: [...state.cart.values()], turnstileToken })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo enviar la solicitud de cotización.");
    state.cart.clear();
    updateCartButton();
    renderOrderItems();
    orderForm.reset();
    showOrderMessage(`Solicitud ${result.orderId} recibida correctamente. Te responderemos con la cotización.`, true);
  } catch (error) {
    showOrderMessage(error.message || "No se pudo enviar la solicitud de cotización.");
    resetTurnstile();
  } finally {
    submitOrderButton.disabled = state.cart.size === 0;
    submitOrderButton.textContent = "Solicitar cotización";
  }
}

function showOrderMessage(message, success = false) {
  orderMessage.textContent = message;
  orderMessage.className = `order-message${success ? " success" : ""}`;
}

function loadTurnstileScript() {
  if (document.querySelector('script[data-fhf-turnstile]')) return;
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  script.async = true;
  script.defer = true;
  script.dataset.fhfTurnstile = "true";
  script.addEventListener("load", () => {
    if (orderDialog.open) renderTurnstile();
  });
  document.head.appendChild(script);
}

function renderTurnstile() {
  if (!state.ordering.turnstileSiteKey || !window.turnstile || state.turnstileWidgetId !== null) return;
  state.turnstileWidgetId = window.turnstile.render("#turnstileContainer", {
    sitekey: state.ordering.turnstileSiteKey
  });
}

function getTurnstileToken() {
  return state.turnstileWidgetId === null || !window.turnstile
    ? ""
    : window.turnstile.getResponse(state.turnstileWidgetId);
}

function resetTurnstile() {
  if (state.turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.reset(state.turnstileWidgetId);
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
  image.src = withMediaVersion(product.image);
  image.alt = product.title || product.sku || "Producto";
  container.appendChild(image);
}

function withMediaVersion(fileName) {
  if (!state.mediaVersion) return fileName;
  return `${fileName}${fileName.includes("?") ? "&" : "?"}v=${state.mediaVersion}`;
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
cartButton.addEventListener("click", openOrderDialog);
closeOrderButton.addEventListener("click", () => orderDialog.close());
orderForm.addEventListener("submit", submitOrder);

loadCatalog().catch(error => {
  productsGrid.textContent = "No se pudo cargar el catalogo: " + error.message;
  console.error(error);
});