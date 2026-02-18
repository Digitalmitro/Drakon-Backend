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

function resolveSize(cartItem = {}) {
  if (cartItem.size) return String(cartItem.size);

  const product = cartItem.productId || {};
  if (Array.isArray(product.size) && product.size.length === 1 && product.size[0]?.size) {
    return String(product.size[0].size);
  }

  return "One Size";
}

function resolveUpc(cartItem = {}, resolvedSize = "") {
  if (cartItem.upc) return String(cartItem.upc);

  const product = cartItem.productId || {};
  if (Array.isArray(product.size) && resolvedSize) {
    const sizeEntry = product.size.find((entry) => entry?.size === resolvedSize);
    if (sizeEntry?.upc) return String(sizeEntry.upc);
  }

  if (product.upc) return String(product.upc);

  if (Array.isArray(product.size)) {
    const firstUpc = product.size.find((entry) => entry?.upc)?.upc;
    if (firstUpc) return String(firstUpc);
  }

  return "";
}

function mapCartItemsToOrderItems(cartItems = []) {
  return cartItems.map((cartItem, idx) => {
    const product = cartItem?.productId || {};
    const productIdValue = product?._id || cartItem?.productId;
    const size = resolveSize(cartItem);
    const upc = resolveUpc(cartItem, size);
    const rawWeight = cartItem?.weight ?? product?.weight ?? 0;
    const weight = toNumber(rawWeight, 0);
    const weightUnits = normalizeWeightUnits(cartItem?.weightUnits || product?.weightUnits);
    const baseOptions = cartItem?.options && typeof cartItem.options === "object" ? cartItem.options : {};
    const options = {
      ...baseOptions,
      ...(size && size !== "One Size" ? { Size: size } : {}),
    };

    return {
      sku: productIdValue ? String(productIdValue) : `item-${idx + 1}`,
      upc,
      name: cartItem?.name || product?.title || `Product ${idx + 1}`,
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