function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWeightUnits(units) {
  if (!units) return "Pounds";

  const normalized = String(units).trim().toLowerCase();
  if (["lb", "lbs", "pound", "pounds"].includes(normalized)) return "Pounds";
  if (["oz", "ounce", "ounces"].includes(normalized)) return "Ounces";
  if (["g", "gram", "grams"].includes(normalized)) return "Grams";
  if (["kg", "kilogram", "kilograms"].includes(normalized)) return "Kilograms";

  return String(units);
}

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getProductVariantBySize(product = {}, resolvedSize = "") {
  if (!Array.isArray(product.size) || !resolvedSize) return null;
  return product.size.find((entry) => safeString(entry?.size) === safeString(resolvedSize)) || null;
}

function appendSizeToName(baseName = "", size = "") {
  const normalizedName = safeString(baseName);
  const normalizedSize = safeString(size);
  if (!normalizedSize || normalizedSize === "One Size") return normalizedName;

  const lowerName = normalizedName.toLowerCase();
  const lowerSize = normalizedSize.toLowerCase();
  if (lowerName.endsWith(lowerSize)) return normalizedName;

  return `${normalizedName} ${normalizedSize}`.trim();
}

function resolveSize(cartItem = {}) {
  if (cartItem.size) return String(cartItem.size);

  const product = cartItem.productId || {};
  if (Array.isArray(product.size) && product.size.length === 1 && product.size[0]?.size) {
    return String(product.size[0].size);
  }

  return "One Size";
}

function resolveSku(cartItem = {}, product = {}, resolvedSize = "", fallbackName = "") {
  if (cartItem.sku) return String(cartItem.sku);

  const variant = getProductVariantBySize(product, resolvedSize);
  if (variant?.sku) return String(variant.sku);

  if (product.sku) return String(product.sku);

  const skuFromName = appendSizeToName(fallbackName, resolvedSize);
  if (skuFromName) return skuFromName;

  return "";
}

function resolveUpc(cartItem = {}, resolvedSize = "") {
  if (cartItem.upc) return String(cartItem.upc);

  const product = cartItem.productId || {};
  if (Array.isArray(product.size) && resolvedSize) {
    const sizeEntry = product.size.find((entry) => safeString(entry?.size) === safeString(resolvedSize));
    if (sizeEntry?.upc) return String(sizeEntry.upc);
  }

  if (product.upc) return String(product.upc);

  if (Array.isArray(product.size)) {
    const firstUpc = product.size.find((entry) => entry?.upc)?.upc;
    if (firstUpc) return String(firstUpc);
  }

  return "";
}

function resolveWeight(cartItem = {}, product = {}, resolvedSize = "") {
  if (cartItem?.weight !== undefined && cartItem?.weight !== null) {
    return toNumber(cartItem.weight, 0);
  }

  const variant = getProductVariantBySize(product, resolvedSize);
  if (variant?.weight !== undefined && variant?.weight !== null) {
    return toNumber(variant.weight, 0);
  }

  return toNumber(product?.weight, 0);
}

function resolveWeightUnit(cartItem = {}, product = {}, resolvedSize = "") {
  if (cartItem?.weightUnits) return normalizeWeightUnits(cartItem.weightUnits);

  const variant = getProductVariantBySize(product, resolvedSize);
  if (variant?.weightUnits) return normalizeWeightUnits(variant.weightUnits);

  return normalizeWeightUnits(product?.weightUnits);
}

function mapCartItemsToOrderItems(cartItems = []) {
  return cartItems.map((cartItem, idx) => {
    const product = cartItem?.productId || {};
    const productIdValue = product?._id || cartItem?.productId || "";
    const baseName = cartItem?.name || product?.title || `Product ${idx + 1}`;
    const size = resolveSize(cartItem);
    const sku = resolveSku(cartItem, product, size, baseName);
    const upc = resolveUpc(cartItem, size);
    const weight = resolveWeight(cartItem, product, size);
    const weightUnits = resolveWeightUnit(cartItem, product, size);
    const baseOptions = cartItem?.options && typeof cartItem.options === "object" ? cartItem.options : {};
    const options = {
      ...baseOptions,
      ...(size && size !== "One Size" ? { Size: size } : {}),
    };
    const name = appendSizeToName(baseName, size) || `Product ${idx + 1}`;

    return {
      sku: sku || (productIdValue ? String(productIdValue) : `item-${idx + 1}`),
      upc,
      name,
      size,
      weight,
      weightUnits,
      quantity: cartItem?.quantity,
      unitPrice: cartItem?.price,
      options,
      location: cartItem?.location || "",
    };
  });
}

module.exports = {
  mapCartItemsToOrderItems,
  normalizeWeightUnits,
};