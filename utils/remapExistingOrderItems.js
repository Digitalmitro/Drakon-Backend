require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { FeaturedpoductModal } = require("../models/ClientModel/FeaturedProducts");
const { ProductsModal } = require("../models/AdminModel/ProductModel");
const shipstationService = require("../services/shipstationService");
const { normalizeWeightUnits } = require("./orderItemMapper");

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function key(value) {
  return cleanString(value).toLowerCase();
}

function titleKey(value) {
  return key(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isObjectIdLike(value) {
  return /^[a-f\d]{24}$/i.test(cleanString(value));
}

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cleanString(value)
  );
}

function isGeneratedSku(value) {
  const normalized = cleanString(value);
  if (!normalized) return true;
  return isObjectIdLike(normalized) || isUuidLike(normalized);
}

function getItemSize(item = {}) {
  const direct = cleanString(item.size);
  if (direct) return direct;

  const options = item.options && typeof item.options === "object" ? item.options : null;
  if (!options) return "";

  if (options instanceof Map) {
    return cleanString(options.get("Size") || options.get("size"));
  }

  return cleanString(options.Size || options.size);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pushToMap(map, mapKey, entry) {
  const normalized = key(mapKey);
  if (!normalized) return;
  const existing = map.get(normalized) || [];
  existing.push(entry);
  map.set(normalized, existing);
}

function normalizeProduct(product = {}) {
  const base = {
    _id: cleanString(product._id),
    title: cleanString(product.title),
    sku: cleanString(product.sku),
    upc: cleanString(product.upc),
    weight: toNumber(product.weight, 0),
    weightUnits: normalizeWeightUnits(product.weightUnits),
    size: Array.isArray(product.size)
      ? product.size.map((entry) => ({
          size: cleanString(entry?.size),
          sku: cleanString(entry?.sku),
          upc: cleanString(entry?.upc),
          weight: toNumber(entry?.weight, NaN),
          weightUnits: normalizeWeightUnits(entry?.weightUnits),
        }))
      : [],
  };

  return base;
}

function buildProductIndexes(products) {
  const byId = new Map();
  const bySku = new Map();
  const byUpc = new Map();
  const byTitle = new Map();

  for (const raw of products) {
    const product = normalizeProduct(raw);
    if (!product._id || !product.title) continue;

    byId.set(product._id, product);
    pushToMap(byTitle, titleKey(product.title), { product, variant: null });

    if (product.sku) pushToMap(bySku, product.sku, { product, variant: null });
    if (product.upc) pushToMap(byUpc, product.upc, { product, variant: null });

    for (const variant of product.size) {
      if (variant.sku) pushToMap(bySku, variant.sku, { product, variant });
      if (variant.upc) pushToMap(byUpc, variant.upc, { product, variant });
    }
  }

  return { byId, bySku, byUpc, byTitle };
}

function buildShipstationByUpc(products) {
  const byUpc = new Map();

  for (const product of products || []) {
    const upc = cleanString(product?.upc);
    if (!upc) continue;

    const sku = cleanString(product?.sku);
    const name = cleanString(product?.name || product?.productName || product?.title);
    byUpc.set(key(upc), { sku, name, upc });
  }

  return byUpc;
}

function addCandidate(candidates, entry, score, source) {
  const productId = cleanString(entry?.product?._id);
  if (!productId) return;
  const variantSize = cleanString(entry?.variant?.size);
  const candidateKey = `${productId}|${variantSize}`;
  const existing = candidates.get(candidateKey);
  if (!existing || score > existing.score) {
    candidates.set(candidateKey, { ...entry, score, source });
  }
}

function resolveProductMatch(item, indexes) {
  const sku = cleanString(item.sku);
  const upc = cleanString(item.upc);
  const size = cleanString(getItemSize(item));
  const name = cleanString(item.name);
  const candidates = new Map();

  if (sku && isObjectIdLike(sku) && indexes.byId.has(sku)) {
    addCandidate(candidates, { product: indexes.byId.get(sku), variant: null }, 75, "id");
  }

  if (sku) {
    const skuMatches = indexes.bySku.get(key(sku)) || [];
    for (const entry of skuMatches) addCandidate(candidates, entry, 80, "sku");
  }

  if (upc) {
    const upcMatches = indexes.byUpc.get(key(upc)) || [];
    for (const entry of upcMatches) addCandidate(candidates, entry, 100, "upc");
  }

  if (name) {
    const titleMatches = indexes.byTitle.get(titleKey(name)) || [];
    for (const entry of titleMatches) addCandidate(candidates, entry, 45, "title");
  }

  const all = [...candidates.values()];
  if (all.length === 0) return null;

  const targetSize = key(size);
  if (targetSize) {
    for (const candidate of all) {
      const variantSize = key(candidate.variant?.size);
      if (variantSize && variantSize === targetSize) {
        candidate.score += 25;
      }
    }
  }

  all.sort((a, b) => b.score - a.score);
  return all[0];
}

function resolveVariant(product, matchedVariant, size) {
  if (matchedVariant) return matchedVariant;
  const normalizedSize = key(size);
  if (normalizedSize && Array.isArray(product.size)) {
    const sameSize = product.size.find((entry) => key(entry.size) === normalizedSize);
    if (sameSize) return sameSize;
  }
  if (Array.isArray(product.size) && product.size.length === 1) return product.size[0];
  return null;
}

function buildRemappedItem(item, match, shipstationByUpc) {
  const product = match.product;
  const existingSize = cleanString(getItemSize(item));
  const variant = resolveVariant(product, match.variant, existingSize);

  const resolvedSize = existingSize || cleanString(variant?.size) || "One Size";
  const resolvedUpc = cleanString(variant?.upc) || cleanString(product.upc) || cleanString(item.upc);
  const shipstationMatch = shipstationByUpc.get(key(resolvedUpc));

  const canonicalName =
    cleanString(shipstationMatch?.name) || cleanString(product.title) || cleanString(item.name);

  const preferredSku =
    cleanString(shipstationMatch?.sku) ||
    cleanString(variant?.sku) ||
    cleanString(product.sku) ||
    cleanString(item.sku);
  const resolvedSku =
    (!isGeneratedSku(preferredSku) ? preferredSku : "") ||
    resolvedUpc ||
    canonicalName ||
    `${product.title}${resolvedSize && resolvedSize !== "One Size" ? ` ${resolvedSize}` : ""}`.trim();

  const variantWeight = Number(variant?.weight);
  const productWeight = Number(product?.weight);
  const itemWeight = Number(item?.weight);
  const resolvedWeight = Number.isFinite(variantWeight)
    ? variantWeight
    : Number.isFinite(productWeight)
    ? productWeight
    : Number.isFinite(itemWeight)
    ? itemWeight
    : 0;

  const resolvedWeightUnits = normalizeWeightUnits(
    cleanString(variant?.weightUnits) ||
      cleanString(product?.weightUnits) ||
      cleanString(item?.weightUnits) ||
      "Pounds"
  );

  const baseOptions = item.options && typeof item.options === "object" ? item.options : {};
  const options = {
    ...baseOptions,
    ...(resolvedSize && resolvedSize !== "One Size" ? { Size: resolvedSize } : {}),
  };

  return {
    ...item,
    sku: resolvedSku,
    upc: resolvedUpc,
    name: canonicalName,
    size: resolvedSize,
    weight: resolvedWeight,
    weightUnits: resolvedWeightUnits,
    options,
  };
}

function didItemChange(before, after) {
  return (
    cleanString(before.sku) !== cleanString(after.sku) ||
    cleanString(before.upc) !== cleanString(after.upc) ||
    cleanString(before.name) !== cleanString(after.name) ||
    cleanString(before.size) !== cleanString(after.size) ||
    toNumber(before.weight, 0) !== toNumber(after.weight, 0) ||
    cleanString(before.weightUnits) !== cleanString(after.weightUnits) ||
    JSON.stringify(before.options || {}) !== JSON.stringify(after.options || {})
  );
}

async function run() {
  const applyChanges = process.argv.includes("--apply");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const [featuredProducts, adminProducts, shipstationProducts] = await Promise.all([
      FeaturedpoductModal.find({}, { _id: 1, title: 1, sku: 1, upc: 1, size: 1, weight: 1, weightUnits: 1 }).lean(),
      ProductsModal.find({}, { _id: 1, title: 1, sku: 1, upc: 1, size: 1, weight: 1, weightUnits: 1 }).lean(),
      shipstationService.getAllProducts().catch((error) => {
        console.warn("⚠️  ShipStation products could not be loaded. Proceeding with internal catalog only.");
        console.warn(error?.message || error);
        return [];
      }),
    ]);

    const products = [...featuredProducts, ...adminProducts];
    const indexes = buildProductIndexes(products);
    const shipstationByUpc = buildShipstationByUpc(shipstationProducts);

    console.log(`📦 Loaded ${products.length} products for remapping`);
    console.log(`🚚 Loaded ${shipstationByUpc.size} ShipStation UPC mappings`);

    const orders = await Order.find({}, { _id: 1, orderNumber: 1, items: 1 }).lean();
    console.log(`🧾 Scanning ${orders.length} orders`);

    let totalItems = 0;
    let matchedItems = 0;
    let updatedItems = 0;
    let updatedOrders = 0;
    let unmatchedItems = 0;

    const unmatchedSamples = [];

    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      let orderChanged = false;

      const remappedItems = items.map((item) => {
        totalItems += 1;

        const match = resolveProductMatch(item, indexes);
        if (!match || !match.product) {
          unmatchedItems += 1;
          if (unmatchedSamples.length < 20) {
            unmatchedSamples.push({
              orderNumber: cleanString(order.orderNumber),
              sku: cleanString(item.sku),
              upc: cleanString(item.upc),
              name: cleanString(item.name),
              size: getItemSize(item),
            });
          }
          return item;
        }

        matchedItems += 1;
        const remapped = buildRemappedItem(item, match, shipstationByUpc);
        if (didItemChange(item, remapped)) {
          updatedItems += 1;
          orderChanged = true;
        }

        return remapped;
      });

      if (orderChanged) {
        updatedOrders += 1;
        if (applyChanges) {
          await Order.updateOne(
            { _id: order._id },
            { $set: { items: remappedItems, lastModified: new Date() } }
          );
        }
      }
    }

    console.log("\n========== ORDER REMAP SUMMARY ==========");
    console.log(`Mode: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
    console.log(`Orders scanned: ${orders.length}`);
    console.log(`Orders updated: ${updatedOrders}`);
    console.log(`Items scanned: ${totalItems}`);
    console.log(`Items matched to products: ${matchedItems}`);
    console.log(`Items updated: ${updatedItems}`);
    console.log(`Items unmatched: ${unmatchedItems}`);

    if (unmatchedSamples.length > 0) {
      console.log("\nUnmatched samples (first 20):");
      unmatchedSamples.forEach((sample, idx) => {
        console.log(`${idx + 1}. ${JSON.stringify(sample)}`);
      });
    }

    if (!applyChanges) {
      console.log("\nℹ️  Dry-run complete. Re-run with --apply to persist changes.");
    } else {
      console.log("\n✅ Remap complete. Existing orders have been updated where matches were found.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Remap migration error:", error);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
}

run();
