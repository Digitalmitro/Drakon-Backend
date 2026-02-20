require('dotenv').config();
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const { ProductsModal } = require('../models/AdminModel/ProductModel');
const { FeaturedpoductModal } = require('../models/ClientModel/FeaturedProducts');
const shipstationService = require('../services/shipstationService');

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseWeightOz(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const numeric = toNumber(raw.replace(/[^0-9.]/g, ''), 0);
  if (raw.toLowerCase().includes('lb')) return numeric * 16;
  return numeric;
}

function parseDimensionInches(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parts = raw
    .replace(/inches?|inch|in/gi, '')
    .split('x')
    .map((part) => toNumber(String(part).replace(/[^0-9.]/g, ''), 0))
    .filter((v) => v > 0);
  if (parts.length < 3) return null;
  return { length: parts[0], width: parts[1], height: parts[2] };
}

async function main() {
  const workbook = xlsx.readFile('/Users/soumikadas/Downloads/upc.xlsx');
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  const workbookByUpc = new Map();
  for (const row of rows) {
    const upc = normalizeUpc(row['UPC Barcode'] || row['UPC'] || row['upc']);
    if (!upc) continue;
    workbookByUpc.set(upc, {
      sku: String(row['Product info'] || row['product info'] || row['SKU'] || '').trim(),
      name: String(row['Product info'] || row['product info'] || row['name'] || '').trim(),
      weightOz: parseWeightOz(row['weight'] || row['Weight'] || ''),
      dimensions: parseDimensionInches(row['Dimension'] || row['dimension'] || ''),
    });
  }
  const workbookSet = new Set(
    rows.map((row) => normalizeUpc(row['UPC Barcode'] || row['UPC'] || row['upc'])).filter(Boolean)
  );

  await mongoose.connect(process.env.MONGO_URI);
  const [admin, featured] = await Promise.all([
    ProductsModal.find({}).lean(),
    FeaturedpoductModal.find({}).lean(),
  ]);

  const adminWorkbookSet = new Set();
  for (const product of [...admin, ...featured]) {
    if (Array.isArray(product.size) && product.size.length > 0) {
      for (const sizeEntry of product.size) {
        const upc = normalizeUpc(sizeEntry?.upc);
        if (upc && workbookSet.has(upc)) adminWorkbookSet.add(upc);
      }
    } else {
      const upc = normalizeUpc(product.upc);
      if (upc && workbookSet.has(upc)) adminWorkbookSet.add(upc);
    }
  }
  await mongoose.disconnect();

  const keepSet = adminWorkbookSet.size === 75 ? adminWorkbookSet : workbookSet;

  const allProducts = await shipstationService.getAllProducts({ pageSize: 500 });
  const firstByUpc = new Set();

  let deactivated = 0;
  let created = 0;
  let failed = 0;

  for (const product of allProducts) {
    const productId = product?.productId;
    if (!productId) continue;

    const upc = normalizeUpc(product?.upc);
    let shouldBeActive = false;

    if (upc && keepSet.has(upc) && !firstByUpc.has(upc)) {
      shouldBeActive = true;
      firstByUpc.add(upc);
    }

    const isCurrentlyActive = product?.active !== false;
    if (isCurrentlyActive === shouldBeActive) continue;

    try {
      await shipstationService.updateProduct(productId, {
        sku: String(product?.sku || upc || productId).trim(),
        name: String(product?.name || product?.productName || product?.sku || upc || productId).trim(),
        upc: upc || undefined,
        active: shouldBeActive,
        weightOz: toNumber(product?.weightOz, 0),
        length: toNumber(product?.length, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_LENGTH, 10),
        width: toNumber(product?.width, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_WIDTH, 8),
        height: toNumber(product?.height, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_HEIGHT, 4),
        defaultCarrierCode: String(product?.defaultCarrierCode || process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || 'stamps_com').trim(),
        defaultServiceCode: String(product?.defaultServiceCode || process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || 'usps_priority').trim(),
        defaultPackageCode: String(product?.defaultPackageCode || process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || 'package').trim(),
        defaultConfirmation: String(product?.defaultConfirmation || process.env.SHIPSTATION_DEFAULT_CONFIRMATION || 'none').trim(),
      });
      if (!shouldBeActive) deactivated += 1;
    } catch (_) {
      failed += 1;
    }
  }

  const refreshedAfterDeactivate = await shipstationService.getAllProducts({ pageSize: 500 });
  const existingUpcs = new Set(refreshedAfterDeactivate.map((product) => normalizeUpc(product?.upc)).filter(Boolean));

  for (const upc of keepSet) {
    if (existingUpcs.has(upc)) continue;

    const workbookInfo = workbookByUpc.get(upc) || {};
    const sku = String(workbookInfo.sku || upc).trim();
    const name = String(workbookInfo.name || sku || `UPC ${upc}`).trim();
    const dims = workbookInfo.dimensions || {};

    try {
      await shipstationService.createProduct({
        sku,
        name,
        upc,
        active: true,
        weightOz: toNumber(workbookInfo.weightOz, 0),
        length: toNumber(dims.length, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_LENGTH, 10),
        width: toNumber(dims.width, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_WIDTH, 8),
        height: toNumber(dims.height, 0) || toNumber(process.env.SHIPSTATION_DEFAULT_PACKAGE_HEIGHT, 4),
        defaultCarrierCode: String(process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || 'stamps_com').trim(),
        defaultServiceCode: String(process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || 'usps_priority').trim(),
        defaultPackageCode: String(process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || 'package').trim(),
        defaultConfirmation: String(process.env.SHIPSTATION_DEFAULT_CONFIRMATION || 'none').trim(),
      });
      created += 1;
    } catch (_) {
      failed += 1;
    }
  }

  const refreshed = await shipstationService.getAllProducts({ pageSize: 500 });
  const activeRows = refreshed.filter((product) => product?.active !== false);
  const activeUniqueUpcs = new Set(activeRows.map((product) => normalizeUpc(product?.upc)).filter(Boolean));

  console.log(JSON.stringify({
    workbookUpcs: workbookSet.size,
    adminWorkbookUpcs: adminWorkbookSet.size,
    keepSetSize: keepSet.size,
    totalProducts: refreshed.length,
    activeRows: activeRows.length,
    activeUniqueUpcs: activeUniqueUpcs.size,
    deactivated,
    created,
    failed,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { main };
