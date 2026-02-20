require('dotenv').config();
const mongoose = require('mongoose');
const shipstationService = require('../services/shipstationService');
const { FeaturedpoductModal } = require('../models/ClientModel/FeaturedProducts');
const ProductIdentityMap = require('../models/ProductIdentityMap');

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function isLikelyUpcSku(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeUpc(raw);
  return !!normalized && normalized.length >= 8 && normalized === raw;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toWeightOz(weight, unit) {
  const n = toNumber(weight, 0);
  if (n <= 0) return 0;
  const normalizedUnit = String(unit || 'Pounds').toLowerCase();
  if (normalizedUnit.includes('ounce')) return n;
  if (normalizedUnit.includes('kg')) return n * 35.274;
  if (normalizedUnit === 'g' || normalizedUnit.includes('gram')) return n / 28.3495;
  return n * 16;
}

function buildName(title, sizeLabel) {
  const base = String(title || '').trim();
  const size = String(sizeLabel || '').trim();
  if (!size || size.toLowerCase() === 'one size') return base;
  if (!base) return size;
  if (base.toLowerCase().endsWith(size.toLowerCase())) return base;
  return `${base} ${size}`.trim();
}

function sanitizeThumbnailUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.startsWith('data:')) return '';
  return value;
}

function buildDesiredCatalogByUpc(catalogProducts) {
  const desiredByUpc = new Map();

  for (const product of catalogProducts) {
    const title = String(product?.title || '').trim();
    const description = String(product?.description || '').trim();
    const category = String(product?.category || '').trim();
    const price = toNumber(product?.price, 0);
    const image = Array.isArray(product?.image) && product.image.length > 0
      ? String(product.image[0] || '').trim()
      : '';

    const variants = Array.isArray(product?.size) && product.size.length > 0
      ? product.size.map((sizeItem) => ({
          size: String(sizeItem?.size || '').trim(),
          upc: normalizeUpc(sizeItem?.upc),
          sku: String(sizeItem?.sku || '').trim(),
          weight: toNumber(sizeItem?.weight, 0),
          weightUnits: String(sizeItem?.weightUnits || product?.weightUnits || 'Pounds').trim(),
        }))
      : [{
          size: '',
          upc: normalizeUpc(product?.upc),
          sku: String(product?.sku || '').trim(),
          weight: toNumber(product?.weight, 0),
          weightUnits: String(product?.weightUnits || 'Pounds').trim(),
        }];

    for (const variant of variants) {
      const upc = normalizeUpc(variant.upc);
      if (!upc) {
        continue;
      }

      const sku = String(variant.sku || product?.sku || '').trim();
      const weightOzFromAdmin = toWeightOz(variant.weight, variant.weightUnits);
      const weightOz = weightOzFromAdmin > 0 ? weightOzFromAdmin : 0;

      desiredByUpc.set(upc, {
        upc,
        sku,
        name: buildName(title, variant.size),
        category,
        price,
        active: product?.isSoldOut !== true,
        thumbnailUrl: image,
        image,
        description,
        weightOz,
        adminProductId: String(product?._id || ''),
      });
    }
  }

  return desiredByUpc;
}

async function syncShipstationCatalogFromAdmin({
  dryRun = true,
  deleteMissing = true,
  limit = null,
} = {}) {
  const catalogProducts = await FeaturedpoductModal.find({}).lean();
  const desiredByUpc = buildDesiredCatalogByUpc(catalogProducts);
  const desiredEntries = [...desiredByUpc.values()];
  const scopedDesiredEntries = Number.isFinite(limit) && limit > 0
    ? desiredEntries.slice(0, limit)
    : desiredEntries;
  const desiredUpcSet = new Set(desiredEntries.map((entry) => entry.upc));

  if (desiredEntries.length === 0) {
    throw new Error('No catalog products with UPC found. Sync aborted to prevent deleting ShipStation catalog.');
  }

  const shouldDeleteMissing = deleteMissing && !(Number.isFinite(limit) && limit > 0);

  const existingProducts = await shipstationService.getAllProducts({ pageSize: 500 });
  const existingByUpc = new Map();
  const existingBySku = new Map();

  for (const existing of existingProducts) {
    const sku = String(existing?.sku || '').trim().toLowerCase();
    if (sku && !existingBySku.has(sku)) {
      existingBySku.set(sku, existing);
    }

    const upc = normalizeUpc(existing?.upc);
    if (!upc) continue;
    if (!existingByUpc.has(upc)) {
      existingByUpc.set(upc, []);
    }
    existingByUpc.get(upc).push(existing);
  }

  let upserted = 0;
  let deleted = 0;
  let deactivated = 0;
  const failedUpserts = [];
  const failedDeletes = [];
  const identityMapFailures = [];
  const protectedProductIds = new Set();

  for (const desired of scopedDesiredEntries) {
    const matchesByUpc = existingByUpc.get(desired.upc) || [];
    const matchBySku = existingBySku.get(String(desired.sku || '').trim().toLowerCase()) || null;
    const existingPrimary = matchBySku || matchesByUpc[0] || null;
    if (existingPrimary?.productId) {
      protectedProductIds.add(String(existingPrimary.productId));
    }
    const sanitizedThumbnailUrl = sanitizeThumbnailUrl(desired.thumbnailUrl);
    const payload = {
      sku: '',
      name: desired.name,
      upc: desired.upc,
      price: desired.price,
      active: desired.active,
      weightOz: desired.weightOz,
      length: toNumber(existingPrimary?.length, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_LENGTH, 10),
      width: toNumber(existingPrimary?.width, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_WIDTH, 8),
      height: toNumber(existingPrimary?.height, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_HEIGHT, 4),
      defaultCarrierCode: String(existingPrimary?.defaultCarrierCode || process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || 'stamps_com').trim(),
      defaultServiceCode: String(existingPrimary?.defaultServiceCode || process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || 'usps_priority').trim(),
      defaultPackageCode: String(existingPrimary?.defaultPackageCode || process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || 'package').trim(),
      defaultConfirmation: String(existingPrimary?.defaultConfirmation || process.env.SHIPSTATION_DEFAULT_CONFIRMATION || 'none').trim(),
    };

    const desiredSku = String(desired.sku || '').trim();
    const existingSku = String(existingPrimary?.sku || '').trim();
    payload.sku = (!isLikelyUpcSku(desiredSku) && desiredSku)
      || existingSku
      || desiredSku
      || String(desired.name || desired.upc || '').trim();
    if (sanitizedThumbnailUrl) {
      payload.thumbnailUrl = sanitizedThumbnailUrl;
    }

    try {
      if (!dryRun) {
        if (existingPrimary?.productId) {
          await shipstationService.updateProduct(existingPrimary.productId, payload);
        } else {
          await shipstationService.createProduct(payload);
        }

        upserted += 1;

        try {
        await ProductIdentityMap.updateOne(
          { upcNormalized: desired.upc },
          {
            $setOnInsert: {
              upcNormalized: desired.upc,
              source: 'admin',
              isActive: true,
            },
            $set: {
              sourceProductId: desired.adminProductId,
              canonicalSku: payload.sku,
              canonicalName: desired.name,
              'metadata.shipstationSku': payload.sku,
              'metadata.shipstationProductName': desired.name,
              'metadata.productCategory': desired.category,
              'metadata.adminImage': desired.image,
              'metadata.adminDescription': desired.description,
            },
          },
          { upsert: true }
        );
        } catch (identityError) {
          identityMapFailures.push({
            upc: desired.upc,
            sku: payload.sku,
            error: identityError.message || String(identityError),
          });
        }
      } else {
        upserted += 1;
      }
    } catch (error) {
      failedUpserts.push({
        upc: desired.upc,
        sku: payload.sku,
        error: error.response?.data || error.message || String(error),
      });
    }
  }

  const staleProducts = existingProducts.filter((product) => {
    const productId = String(product?.productId || '').trim();
    if (productId && protectedProductIds.has(productId)) {
      return false;
    }

    const upc = normalizeUpc(product?.upc);
    if (!upc) return false;
    return !desiredUpcSet.has(upc);
  });

  if (shouldDeleteMissing) {
    for (const stale of staleProducts) {
      const productId = stale?.productId;
      const upc = normalizeUpc(stale?.upc);
      if (!productId || !upc) continue;

      try {
        if (!dryRun) {
          await shipstationService.updateProduct(productId, {
            sku: String(stale?.sku || upc).trim(),
            name: String(stale?.name || stale?.productName || upc).trim(),
            upc,
            active: false,
          });
          deactivated += 1;
        } else {
          deleted += 1;
        }
      } catch (error) {
        failedDeletes.push({
          productId,
          upc,
          sku: String(stale?.sku || '').trim(),
          error: error.response?.data || error.message || String(error),
        });
      }
    }
  }

  return {
    dryRun,
    source: 'catalog-ui-products',
    adminProductsScanned: catalogProducts.length,
    desiredProductsFromAdmin: scopedDesiredEntries.length,
    existingShipstationProducts: existingProducts.length,
    staleShipstationProducts: staleProducts.length,
    deleteMissing: shouldDeleteMissing,
    upserted,
    deleted,
    deactivated,
    failedUpserts,
    failedDeletes,
    identityMapFailures,
  };
}

async function runCli() {
  const dryRun = !process.argv.includes('--apply');
  const deleteMissing = !process.argv.includes('--no-delete');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI');
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const result = await syncShipstationCatalogFromAdmin({
      dryRun,
      deleteMissing,
      limit,
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  runCli().catch(async (error) => {
    console.error(error.message || error);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  });
}

module.exports = {
  syncShipstationCatalogFromAdmin,
};
