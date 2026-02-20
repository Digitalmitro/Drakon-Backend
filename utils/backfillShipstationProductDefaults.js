require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

let XLSX = null;
try {
  XLSX = require('xlsx');
} catch (_) {
  XLSX = null;
}

const BASE_URL = 'https://ssapi.shipstation.com';
const auth = {
  username: process.env.SHIPSTATION_API_KEY,
  password: process.env.SHIPSTATION_API_SECRET,
};

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function isLikelyUpcSku(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeUpc(raw);
  return !!normalized && normalized.length >= 8 && raw === normalized;
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
  if (raw.toLowerCase().includes('kg')) return numeric * 35.274;
  if (raw.toLowerCase().includes('g')) return numeric / 28.3495;
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
  return {
    length: parts[0],
    width: parts[1],
    height: parts[2],
  };
}

function getWorkbookPath() {
  const cliPath = process.argv.find((arg) => arg.startsWith('--xlsx='));
  if (cliPath) return cliPath.replace('--xlsx=', '');

  const candidates = [
    '/Users/soumikadas/Downloads/upc.xlsx',
    path.resolve(process.cwd(), 'upc.xlsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return '';
}

function loadWorkbook() {
  const byUpc = new Map();
  const byName = new Map();

  if (!XLSX) return { byUpc, byName };
  const workbookPath = getWorkbookPath();
  if (!workbookPath) return { byUpc, byName };

  const workbook = XLSX.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  for (const row of rows) {
    const upc = normalizeUpc(row['UPC Barcode'] || row['UPC'] || row['upc']);
    const productInfo = String(row['Product info'] || row['product info'] || '').trim();
    const dimensions = parseDimensionInches(row['Dimension'] || row['dimension'] || '');
    const weightOz = parseWeightOz(row['weight'] || row['Weight'] || '');

    const value = {
      upc,
      productInfo,
      dimensions,
      weightOz,
    };

    if (upc) byUpc.set(upc, value);
    if (productInfo) byName.set(normalizeText(productInfo), value);
  }

  return { byUpc, byName };
}

async function getAllProducts() {
  const all = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    const { data } = await axios.get(`${BASE_URL}/products`, {
      auth,
      params: { page, pageSize },
    });

    const products = data?.products || [];
    all.push(...products);

    if (!products.length || page >= (data?.pages || 1)) break;
    page += 1;
  }

  return all;
}

function resolveWorkbookData(product, workbook) {
  const upc = normalizeUpc(product?.upc);
  if (upc && workbook.byUpc.has(upc)) return workbook.byUpc.get(upc);

  const bySku = normalizeText(product?.sku);
  if (bySku && workbook.byName.has(bySku)) return workbook.byName.get(bySku);

  const byName = normalizeText(product?.name || product?.productName);
  if (byName && workbook.byName.has(byName)) return workbook.byName.get(byName);

  return null;
}

function buildUpdatePayload(product, workbookData) {
  const defaultCarrierCode = String(process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || 'stamps_com').trim();
  const defaultServiceCode = String(process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || 'usps_priority').trim();
  const defaultPackageCode = String(process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || 'package').trim();
  const defaultConfirmation = String(process.env.SHIPSTATION_DEFAULT_CONFIRMATION || 'none').trim();

  const upc = normalizeUpc(product?.upc) || normalizeUpc(workbookData?.upc);
  const dims = workbookData?.dimensions;
  const weightOz = toNumber(product?.weightOz, 0) > 0
    ? toNumber(product.weightOz, 0)
    : toNumber(workbookData?.weightOz, 0);

  const existingSku = String(product?.sku || '').trim();
  const preferredSku = String(workbookData?.productInfo || '').trim();
  const resolvedSku = (!isLikelyUpcSku(existingSku) && existingSku)
    || preferredSku
    || existingSku
    || upc;

  const existingName = String(product?.name || product?.productName || '').trim();
  const resolvedName = existingName || preferredSku || `UPC ${upc}`;

  return {
    productId: product.productId,
    sku: resolvedSku,
    name: resolvedName,
    upc: upc || undefined,
    price: toNumber(product?.price, 0),
    length: toNumber(product?.length, 0) || toNumber(dims?.length, 0),
    width: toNumber(product?.width, 0) || toNumber(dims?.width, 0),
    height: toNumber(product?.height, 0) || toNumber(dims?.height, 0),
    weightOz: weightOz,
    defaultCarrierCode: String(product?.defaultCarrierCode || defaultCarrierCode).trim(),
    defaultServiceCode: String(product?.defaultServiceCode || defaultServiceCode).trim(),
    defaultPackageCode: String(product?.defaultPackageCode || defaultPackageCode).trim(),
    defaultConfirmation: String(product?.defaultConfirmation || defaultConfirmation).trim(),
    active: product?.active !== false,
  };
}

function hasMaterialChange(product, payload) {
  const fields = [
    'sku',
    'name',
    'length',
    'width',
    'height',
    'weightOz',
    'defaultCarrierCode',
    'defaultServiceCode',
    'defaultPackageCode',
    'defaultConfirmation',
  ];

  for (const field of fields) {
    if (String(product?.[field] ?? '') !== String(payload?.[field] ?? '')) {
      return true;
    }
  }

  return false;
}

async function main() {
  if (!auth.username || !auth.password) {
    throw new Error('Missing SHIPSTATION_API_KEY/SHIPSTATION_API_SECRET');
  }

  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;

  const workbook = loadWorkbook();
  let products = await getAllProducts();

  if (Number.isFinite(limit) && limit > 0) {
    products = products.slice(0, limit);
  }

  let scanned = 0;
  let targeted = 0;
  let updated = 0;
  let failed = 0;

  for (const product of products) {
    scanned += 1;
    const workbookData = resolveWorkbookData(product, workbook);
    const payload = buildUpdatePayload(product, workbookData);

    if (!hasMaterialChange(product, payload)) {
      continue;
    }

    targeted += 1;

    if (dryRun) {
      console.log(`[DRY] productId=${product.productId} sku=${product.sku} upc=${product.upc} -> defaults=${payload.defaultCarrierCode}/${payload.defaultServiceCode}/${payload.defaultPackageCode}/${payload.defaultConfirmation}`);
      continue;
    }

    try {
      await axios.post(`${BASE_URL}/products/createproduct`, payload, { auth });
      updated += 1;
    } catch (error) {
      failed += 1;
      const details = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      console.error(`[FAIL] productId=${product.productId} sku=${product.sku} ${details}`);
    }
  }

  console.log(JSON.stringify({
    dryRun,
    scanned,
    targeted,
    updated,
    failed,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
