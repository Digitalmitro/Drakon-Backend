require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { FeaturedpoductModal } = require("../models/ClientModel/FeaturedProducts");
const { ProductsModal } = require("../models/AdminModel/ProductModel");

function cleanString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getSizeKey(value) {
  return cleanString(value).toLowerCase();
}

function getItemSize(item = {}) {
  const fromSize = cleanString(item.size);
  if (fromSize) return fromSize;

  const options = item.options && typeof item.options === "object" ? item.options : null;
  if (!options) return "";

  if (options instanceof Map) {
    const sizeFromMap = cleanString(options.get("Size") || options.get("size"));
    return sizeFromMap;
  }

  return cleanString(options.Size || options.size);
}

function buildProductMaps(products) {
  const byId = new Map();
  const byTitle = new Map();

  for (const product of products) {
    const id = cleanString(product._id);
    if (id) byId.set(id, product);

    const titleKey = getSizeKey(product.title);
    if (titleKey) {
      const existing = byTitle.get(titleKey) || [];
      existing.push(product);
      byTitle.set(titleKey, existing);
    }
  }

  return { byId, byTitle };
}

function resolveProductForItem(item, maps) {
  const skuKey = cleanString(item.sku);
  if (skuKey && maps.byId.has(skuKey)) {
    return maps.byId.get(skuKey);
  }

  const titleKey = getSizeKey(item.name);
  if (!titleKey || !maps.byTitle.has(titleKey)) return null;

  const matches = maps.byTitle.get(titleKey);
  if (matches.length === 1) return matches[0];

  return null;
}

function resolveUpcForItem(item, product) {
  if (!product) return "";

  const itemSize = getItemSize(item);
  const sizeArray = Array.isArray(product.size) ? product.size : [];
  if (itemSize && sizeArray.length > 0) {
    const targetSize = getSizeKey(itemSize);
    const sizeMatch = sizeArray.find((entry) => getSizeKey(entry?.size) === targetSize);
    const sizeUpc = cleanString(sizeMatch?.upc);
    if (sizeUpc) return sizeUpc;
  }

  const productUpc = cleanString(product.upc);
  if (productUpc) return productUpc;

  const firstSizeUpc = sizeArray.map((entry) => cleanString(entry?.upc)).find((value) => value);
  return firstSizeUpc || "";
}

async function run() {
  const applyChanges = process.argv.includes("--apply");

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const [featuredProducts, adminProducts] = await Promise.all([
      FeaturedpoductModal.find({}, { _id: 1, title: 1, upc: 1, size: 1 }).lean(),
      ProductsModal.find({}, { _id: 1, title: 1, upc: 1, size: 1 }).lean(),
    ]);

    const combinedProducts = [...featuredProducts, ...adminProducts];
    const maps = buildProductMaps(combinedProducts);
    console.log(`📦 Loaded ${combinedProducts.length} products for UPC mapping`);

    const orders = await Order.find({}, { _id: 1, orderNumber: 1, items: 1 }).lean();
    console.log(`🧾 Scanning ${orders.length} orders`);

    let ordersTouched = 0;
    let itemsUpdated = 0;
    let itemsSkippedAlreadyHasUpc = 0;
    let itemsNoProductMatch = 0;
    let itemsNoResolvedUpc = 0;
    const unresolvedSamples = [];

    for (const order of orders) {
      const items = Array.isArray(order.items) ? order.items : [];
      let orderChanged = false;
      const updatedItems = items.map((item) => {
        const currentUpc = cleanString(item.upc);
        if (currentUpc) {
          itemsSkippedAlreadyHasUpc += 1;
          return item;
        }

        const product = resolveProductForItem(item, maps);
        if (!product) {
          itemsNoProductMatch += 1;
          if (unresolvedSamples.length < 15) {
            unresolvedSamples.push({
              reason: "NO_PRODUCT_MATCH",
              orderId: cleanString(order._id),
              orderNumber: cleanString(order.orderNumber),
              sku: cleanString(item.sku),
              name: cleanString(item.name),
              size: getItemSize(item),
            });
          }
          return item;
        }

        const resolvedUpc = resolveUpcForItem(item, product);
        if (!resolvedUpc) {
          itemsNoResolvedUpc += 1;
          if (unresolvedSamples.length < 15) {
            unresolvedSamples.push({
              reason: "NO_UPC_ON_PRODUCT",
              orderId: cleanString(order._id),
              orderNumber: cleanString(order.orderNumber),
              sku: cleanString(item.sku),
              name: cleanString(item.name),
              size: getItemSize(item),
              productId: cleanString(product._id),
              productTitle: cleanString(product.title),
            });
          }
          return item;
        }

        orderChanged = true;
        itemsUpdated += 1;
        return {
          ...item,
          upc: resolvedUpc,
        };
      });

      if (orderChanged) {
        ordersTouched += 1;
        if (applyChanges) {
          await Order.updateOne(
            { _id: order._id },
            { $set: { items: updatedItems, lastModified: new Date() } }
          );
        }
      }
    }

    console.log("\n========== UPC BACKFILL SUMMARY ==========");
    console.log(`Mode: ${applyChanges ? "APPLY" : "DRY-RUN"}`);
    console.log(`Orders scanned: ${orders.length}`);
    console.log(`Orders touched: ${ordersTouched}`);
    console.log(`Items updated with UPC: ${itemsUpdated}`);
    console.log(`Items skipped (already had UPC): ${itemsSkippedAlreadyHasUpc}`);
    console.log(`Items unresolved (no product match): ${itemsNoProductMatch}`);
    console.log(`Items unresolved (product has no UPC): ${itemsNoResolvedUpc}`);

    if (unresolvedSamples.length > 0) {
      console.log("\nUnresolved samples (first 15):");
      unresolvedSamples.forEach((sample, index) => {
        console.log(`${index + 1}. ${JSON.stringify(sample)}`);
      });
    }

    if (!applyChanges) {
      console.log("\nℹ️  Dry-run complete. Re-run with --apply to persist updates.");
    } else {
      console.log("\n✅ Apply complete. Existing orders are backfilled with UPC where resolvable.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    try {
      await mongoose.disconnect();
    } catch (_) {
      // no-op
    }
    process.exit(1);
  }
}

run();