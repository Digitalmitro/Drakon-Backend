require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { ProductsModal } = require('../models/AdminModel/ProductModel');
const { FeaturedpoductModal } = require('../models/ClientModel/FeaturedProducts');

let XLSX = null;
try {
  XLSX = require('xlsx');
} catch (_) {
  XLSX = null;
}

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseWeightPounds(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const numeric = toNumber(raw.replace(/[^0-9.]/g, ''), 0);
  if (raw.toLowerCase().includes('oz')) return numeric / 16;
  if (raw.toLowerCase().includes('kg')) return numeric * 2.20462;
  if (raw.toLowerCase().includes('g')) return numeric / 453.592;
  return numeric;
}

function getWorkbookPath() {
  const cliPath = process.argv.find((arg) => arg.startsWith('--file='));
  if (cliPath) return cliPath.replace('--file=', '');

  const candidates = [
    '/Users/soumikadas/Downloads/upc.xlsx',
    path.resolve(process.cwd(), 'upc.xlsx'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return '';
}

function loadWorkbookByUpc() {
  if (!XLSX) throw new Error('Missing xlsx dependency');
  const workbookPath = getWorkbookPath();
  if (!workbookPath) throw new Error('Could not find upc.xlsx. Use --file=...');

  const workbook = XLSX.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const byUpc = new Map();

  for (const row of rows) {
    const upc = normalizeUpc(row['UPC Barcode'] || row['UPC'] || row['upc']);
    if (!upc) continue;

    byUpc.set(upc, {
      sku: String(row['Product info'] || row['product info'] || row['name'] || '').trim(),
      weightPounds: parseWeightPounds(row['weight'] || row['Weight'] || ''),
    });
  }

  return byUpc;
}

function applyWorkbookToProduct(doc, workbookByUpc) {
  let changed = false;

  const rootUpc = normalizeUpc(doc.upc);
  if (rootUpc && workbookByUpc.has(rootUpc)) {
    const data = workbookByUpc.get(rootUpc);
    if (data.sku && doc.sku !== data.sku) {
      doc.sku = data.sku;
      changed = true;
    }
    if (data.weightPounds > 0 && Number(doc.weight || 0) !== data.weightPounds) {
      doc.weight = data.weightPounds;
      doc.weightUnits = 'Pounds';
      changed = true;
    }
  }

  if (Array.isArray(doc.size)) {
    for (const variant of doc.size) {
      const variantUpc = normalizeUpc(variant?.upc);
      if (!variantUpc || !workbookByUpc.has(variantUpc)) continue;
      const data = workbookByUpc.get(variantUpc);

      if (data.sku && variant.sku !== data.sku) {
        variant.sku = data.sku;
        changed = true;
      }
      if (data.weightPounds > 0 && Number(variant.weight || 0) !== data.weightPounds) {
        variant.weight = data.weightPounds;
        variant.weightUnits = 'Pounds';
        changed = true;
      }
    }
  }

  return changed;
}

async function syncCollection(Model, workbookByUpc, applyChanges) {
  const docs = await Model.find({});
  let scanned = 0;
  let updated = 0;

  for (const doc of docs) {
    scanned += 1;
    const changed = applyWorkbookToProduct(doc, workbookByUpc);
    if (!changed) continue;

    updated += 1;
    if (applyChanges) {
      await doc.save();
    }
  }

  return { scanned, updated };
}

async function main() {
  const applyChanges = process.argv.includes('--apply');
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI');

  const workbookByUpc = loadWorkbookByUpc();
  await mongoose.connect(process.env.MONGO_URI);

  try {
    const [adminResult, featuredResult] = await Promise.all([
      syncCollection(ProductsModal, workbookByUpc, applyChanges),
      syncCollection(FeaturedpoductModal, workbookByUpc, applyChanges),
    ]);

    console.log(JSON.stringify({
      mode: applyChanges ? 'APPLY' : 'DRY_RUN',
      workbookEntries: workbookByUpc.size,
      admin: adminResult,
      featured: featuredResult,
    }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (error) => {
  console.error(error.message || error);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
