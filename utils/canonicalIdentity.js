const ProductIdentityMap = require("../models/ProductIdentityMap");
const SkuAliasMap = require("../models/SkuAliasMap");
const QuarantinedOrderItem = require("../models/QuarantinedOrderItem");
const SyncAuditLog = require("../models/SyncAuditLog");
const { ProductsModal } = require("../models/AdminModel/ProductModel");
const { FeaturedpoductModal } = require("../models/ClientModel/FeaturedProducts");

function safeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeUpc(value) {
  return safeString(value).replace(/\D/g, "");
}

function canonicalSkuFromUpc(upc) {
  return normalizeUpc(upc);
}

async function writeAudit(entityType, entityKey, action, status, details = {}) {
  try {
    await SyncAuditLog.create({ entityType, entityKey, action, status, details });
  } catch (error) {
    console.error("Failed to write sync audit log", error.message || error);
  }
}

function resolveCatalogVariant(product = {}, targetUpc = "") {
  const normalizedTarget = normalizeUpc(targetUpc);

  if (Array.isArray(product.size)) {
    const variant = product.size.find((entry) => normalizeUpc(entry?.upc) === normalizedTarget);
    if (variant) return variant;
  }

  return null;
}

async function findCatalogProductByUpc(upcNormalized) {
  if (!upcNormalized) return null;

  const [adminDirect, featuredDirect] = await Promise.all([
    ProductsModal.findOne({ upc: upcNormalized }, { _id: 1, title: 1, upc: 1, sku: 1, size: 1 }).lean(),
    FeaturedpoductModal.findOne({ upc: upcNormalized }, { _id: 1, title: 1, upc: 1, sku: 1, size: 1 }).lean(),
  ]);

  if (adminDirect) return { source: "admin", product: adminDirect, variant: resolveCatalogVariant(adminDirect, upcNormalized) };
  if (featuredDirect) return { source: "featured", product: featuredDirect, variant: resolveCatalogVariant(featuredDirect, upcNormalized) };

  const [adminVariants, featuredVariants] = await Promise.all([
    ProductsModal.findOne({ "size.upc": upcNormalized }, { _id: 1, title: 1, upc: 1, sku: 1, size: 1 }).lean(),
    FeaturedpoductModal.findOne({ "size.upc": upcNormalized }, { _id: 1, title: 1, upc: 1, sku: 1, size: 1 }).lean(),
  ]);

  if (adminVariants) {
    return { source: "admin", product: adminVariants, variant: resolveCatalogVariant(adminVariants, upcNormalized) };
  }
  if (featuredVariants) {
    return { source: "featured", product: featuredVariants, variant: resolveCatalogVariant(featuredVariants, upcNormalized) };
  }

  return null;
}

async function ensureIdentityForUpc(upcNormalized) {
  if (!upcNormalized) return null;

  const existing = await ProductIdentityMap.findOne({ upcNormalized }).lean();
  if (existing) return existing;

  const catalogMatch = await findCatalogProductByUpc(upcNormalized);
  if (!catalogMatch || !catalogMatch.product) return null;

  const canonicalName = safeString(catalogMatch.variant?.size)
    ? `${safeString(catalogMatch.product.title)} ${safeString(catalogMatch.variant.size)}`
    : safeString(catalogMatch.product.title);

  const identityDoc = await ProductIdentityMap.findOneAndUpdate(
    { upcNormalized },
    {
      $setOnInsert: {
        upcNormalized,
        canonicalSku: canonicalSkuFromUpc(upcNormalized),
        canonicalName: canonicalName || `UPC ${upcNormalized}`,
        source: catalogMatch.source,
        sourceProductId: safeString(catalogMatch.product._id),
        isActive: true,
        metadata: {
          catalogVariantSku: safeString(catalogMatch.variant?.sku),
          catalogProductSku: safeString(catalogMatch.product?.sku),
        },
      },
    },
    { upsert: true, new: true, lean: true }
  );

  await writeAudit("product_identity_map", upcNormalized, "bootstrap_from_catalog", "success", {
    source: catalogMatch.source,
    sourceProductId: safeString(catalogMatch.product._id),
  });

  return identityDoc;
}

async function quarantineItem({ orderNumber = "", item = {}, reason = "UNKNOWN_UPC", source = "order_create", metadata = {} }) {
  const upcRaw = safeString(item.upc);
  const upcNormalized = normalizeUpc(upcRaw);

  const doc = await QuarantinedOrderItem.create({
    orderNumber,
    reason,
    upcRaw,
    upcNormalized,
    skuRaw: safeString(item.sku),
    productName: safeString(item.name),
    size: safeString(item.size),
    quantity: Number(item.quantity) || 1,
    source,
    metadata,
  });

  await writeAudit("quarantined_order_item", `${orderNumber || "pending"}:${doc._id}`, "create", "warning", {
    reason,
    upcRaw,
    upcNormalized,
    source,
  });

  return doc;
}

async function enforceCanonicalOrderItems(items = [], options = {}) {
  const { orderNumber = "", source = "order_create" } = options;

  const canonicalItems = [];
  const quarantined = [];

  for (const rawItem of Array.isArray(items) ? items : []) {
    const upcNormalized = normalizeUpc(rawItem?.upc);

    if (!upcNormalized) {
      const q = await quarantineItem({
        orderNumber,
        item: rawItem,
        reason: "MISSING_OR_INVALID_UPC",
        source,
        metadata: { stage: "canonicalization" },
      });
      quarantined.push(q);
      continue;
    }

    const identity = await ensureIdentityForUpc(upcNormalized);
    if (!identity || !identity.isActive) {
      const q = await quarantineItem({
        orderNumber,
        item: rawItem,
        reason: "UNKNOWN_UPC",
        source,
        metadata: { upcNormalized, stage: "identity_lookup" },
      });
      quarantined.push(q);
      continue;
    }

    const rawSku = safeString(rawItem?.sku);
    if (rawSku && rawSku !== upcNormalized) {
      await SkuAliasMap.updateOne(
        { aliasSku: rawSku, upcNormalized },
        {
          $setOnInsert: {
            aliasSku: rawSku,
            upcNormalized,
            source: "order",
            notes: "Captured from order line item",
          },
        },
        { upsert: true }
      );
    }

    canonicalItems.push({
      ...rawItem,
      upc: upcNormalized,
      sku: upcNormalized,
      name: safeString(identity.canonicalName) || safeString(rawItem?.name) || `UPC ${upcNormalized}`,
    });
  }

  return {
    canonicalItems,
    quarantined,
  };
}

module.exports = {
  normalizeUpc,
  canonicalSkuFromUpc,
  enforceCanonicalOrderItems,
  ensureIdentityForUpc,
  quarantineItem,
  safeString,
};
