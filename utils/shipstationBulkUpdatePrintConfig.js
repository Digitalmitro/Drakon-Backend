require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
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

function normalizeLower(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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

function parseWeightOz(value) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const numeric = toNumber(raw.replace(/[^0-9.]/g, ''), 0);
  if (raw.toLowerCase().includes('lb')) return numeric * 16;
  return numeric;
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

function loadWorkbookByUpc() {
  if (!XLSX) return new Map();
  const workbookPath = getWorkbookPath();
  if (!workbookPath) return new Map();

  const workbook = XLSX.readFile(workbookPath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
  const byUpc = new Map();

  for (const row of rows) {
    const upc = normalizeUpc(row['UPC Barcode'] || row['UPC'] || row['upc']);
    if (!upc) continue;
    byUpc.set(upc, {
      upc,
      productInfo: String(row['Product info'] || row['product info'] || row['name'] || '').trim(),
      dimensions: parseDimensionInches(row['Dimension'] || row['dimension'] || ''),
      weightOz: parseWeightOz(row['weight'] || row['Weight'] || ''),
    });
  }

  return byUpc;
}

async function getAllShipstationProducts() {
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

function buildShipstationByUpc(products = []) {
  const byUpc = new Map();

  for (const product of products) {
    const upc = normalizeUpc(product?.upc);
    if (!upc) continue;
    byUpc.set(upc, {
      sku: String(product?.sku || '').trim(),
      name: String(product?.name || product?.productName || '').trim(),
      weightOz: toNumber(product?.weightOz, 0),
      length: toNumber(product?.length, 0),
      width: toNumber(product?.width, 0),
      height: toNumber(product?.height, 0),
    });
  }

  return byUpc;
}

function mapShipment(order) {
  const defaultCarrierCode = normalizeLower(process.env.SHIPSTATION_DEFAULT_CARRIER_CODE) || 'stamps_com';
  const defaultServiceCode = normalizeLower(process.env.SHIPSTATION_DEFAULT_SERVICE_CODE) || 'usps_priority';
  const defaultPackageCode = normalizeLower(process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE) || 'package';
  const defaultConfirmation = normalizeLower(process.env.SHIPSTATION_DEFAULT_CONFIRMATION) || 'none';

  const custom1 = order?.advancedOptions?.customField1 || order?.customField1 || '';
  const custom2 = order?.advancedOptions?.customField2 || order?.customField2 || '';
  const custom3 = order?.advancedOptions?.customField3 || order?.customField3 || '';
  const requested = order?.requestedShippingService || '';

  const requestedNorm = normalizeLower(requested);
  const serviceNorm = normalizeLower(custom1);

  const serviceCode = serviceNorm
    || (requestedNorm.includes('priority') ? 'usps_priority' : '')
    || defaultServiceCode;
  const packageCode = normalizeLower(custom2) || defaultPackageCode;
  const confirmation = normalizeLower(custom3) || defaultConfirmation;

  return {
    carrierCode: defaultCarrierCode,
    serviceCode,
    packageCode,
    confirmation,
  };
}

function toCreateOrUpdatePayload(order, workbookByUpc, shipstationByUpc) {
  const mapped = mapShipment(order);
  const normalizedItems = (order.items || []).map((item) => {
    const upc = normalizeUpc(item?.upc);
    const workbookProduct = workbookByUpc.get(upc);
    const ssProduct = shipstationByUpc.get(upc);

    const resolvedSku = String(
      (ssProduct && ssProduct.sku)
      || (workbookProduct && workbookProduct.productInfo)
      || item.sku
      || upc
      || ''
    ).trim();

    const resolvedName = String(
      (ssProduct && ssProduct.name)
      || (workbookProduct && workbookProduct.productInfo)
      || item.name
      || 'Item'
    ).trim();

    return {
      lineItemKey: item.lineItemKey || String(item.orderItemId || ''),
      sku: resolvedSku,
      name: resolvedName,
      quantity: item.quantity || 1,
      unitPrice: Number(item.unitPrice || 0),
      weight: item.weight || undefined,
      upc: upc || undefined,
    };
  });

  const firstWithDims = normalizedItems.find((item) => {
    const upc = normalizeUpc(item.upc);
    const workbookProduct = workbookByUpc.get(upc);
    return !!workbookProduct?.dimensions;
  });

  const dimsFromWorkbook = firstWithDims
    ? workbookByUpc.get(normalizeUpc(firstWithDims.upc))?.dimensions
    : null;

  const totalWeightOz = normalizedItems.reduce((sum, item) => {
    const upc = normalizeUpc(item.upc);
    const workbookProduct = workbookByUpc.get(upc);
    const ssProduct = shipstationByUpc.get(upc);
    const qty = Number(item.quantity || 1);
    const baseWeight = toNumber(ssProduct?.weightOz, 0) || toNumber(workbookProduct?.weightOz, 0);
    return sum + (baseWeight > 0 ? baseWeight * qty : 0);
  }, 0);

  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    orderKey: order.orderKey,
    orderDate: order.orderDate,
    orderStatus: order.orderStatus || 'awaiting_shipment',
    customerUsername: order.customerUsername || 'guest',
    customerEmail: order.customerEmail || '',
    billTo: order.billTo,
    shipTo: order.shipTo,
    items: normalizedItems,
    amountPaid: Number(order.amountPaid || 0),
    taxAmount: Number(order.taxAmount || 0),
    shippingAmount: Number(order.shippingAmount || 0),
    paymentMethod: order.paymentMethod || 'Stripe',
    requestedShippingService: order.requestedShippingService || 'USPS Priority Mail',
    carrierCode: mapped.carrierCode,
    serviceCode: mapped.serviceCode,
    packageCode: mapped.packageCode,
    confirmation: mapped.confirmation,
    weight: order.weight || { value: (totalWeightOz > 0 ? totalWeightOz / 16 : 1), units: 'pounds' },
    dimensions: order.dimensions || {
      units: 'inches',
      length: dimsFromWorkbook?.length || 10,
      width: dimsFromWorkbook?.width || 8,
      height: dimsFromWorkbook?.height || 4,
    },
    advancedOptions: {
      ...(order.advancedOptions || {}),
      customField1: order?.advancedOptions?.customField1 || order?.customField1 || mapped.serviceCode,
      customField2: order?.advancedOptions?.customField2 || order?.customField2 || mapped.packageCode,
      customField3: order?.advancedOptions?.customField3 || order?.customField3 || mapped.confirmation,
    },
  };
}

function toMinimalCreateOrUpdatePayload(order, workbookByUpc, shipstationByUpc) {
  const fullPayload = toCreateOrUpdatePayload(order, workbookByUpc, shipstationByUpc);

  return {
    orderId: fullPayload.orderId,
    orderKey: fullPayload.orderKey,
    orderNumber: fullPayload.orderNumber,
    orderDate: fullPayload.orderDate,
    orderStatus: fullPayload.orderStatus,
    customerUsername: fullPayload.customerUsername,
    customerEmail: fullPayload.customerEmail,
    billTo: fullPayload.billTo,
    shipTo: fullPayload.shipTo,
    items: fullPayload.items,
    amountPaid: fullPayload.amountPaid,
    taxAmount: fullPayload.taxAmount,
    shippingAmount: fullPayload.shippingAmount,
    paymentMethod: fullPayload.paymentMethod,
  };
}

function dedupeOrdersByOrderNumber(orders = []) {
  const byOrderNumber = new Map();

  for (const order of orders) {
    const orderNumber = String(order?.orderNumber || '').trim();
    if (!orderNumber) continue;

    const existing = byOrderNumber.get(orderNumber);
    if (!existing) {
      byOrderNumber.set(orderNumber, order);
      continue;
    }

    const existingModified = new Date(existing?.modifyDate || existing?.createDate || existing?.orderDate || 0).getTime();
    const currentModified = new Date(order?.modifyDate || order?.createDate || order?.orderDate || 0).getTime();
    if (currentModified >= existingModified) {
      byOrderNumber.set(orderNumber, order);
    }
  }

  return [...byOrderNumber.values()];
}

async function getShipstationOrders({ orderStatus = '' } = {}) {
  const all = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    const { data } = await axios.get(`${BASE_URL}/orders`, {
      auth,
      params: {
        page,
        pageSize,
        ...(orderStatus ? { orderStatus } : {}),
      },
    });

    const orders = data?.orders || [];
    all.push(...orders);

    if (!orders.length || page >= (data?.pages || 1)) {
      break;
    }

    page += 1;
  }

  return all;
}

async function main() {
  if (!auth.username || !auth.password) {
    throw new Error('Missing SHIPSTATION_API_KEY/SHIPSTATION_API_SECRET in environment');
  }

  const dryRun = process.argv.includes('--dry-run');
  const allStatus = process.argv.includes('--all-status');
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const orderArg = process.argv.find((arg) => arg.startsWith('--order='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const targetOrderNumber = orderArg ? String(orderArg.split('=')[1] || '').trim() : '';
  const orderStatus = allStatus ? '' : 'awaiting_shipment';

  const [orders, shipstationProducts] = await Promise.all([
    getShipstationOrders({ orderStatus }),
    getAllShipstationProducts(),
  ]);
  const workbookByUpc = loadWorkbookByUpc();
  const shipstationByUpc = buildShipstationByUpc(shipstationProducts);
  const dedupedOrders = dedupeOrdersByOrderNumber(orders);
  let targetOrders = dedupedOrders;
  if (targetOrderNumber) {
    targetOrders = dedupedOrders.filter((order) => String(order.orderNumber || '').trim() === targetOrderNumber);
  }
  if (Number.isFinite(limit) && limit > 0) {
    targetOrders = targetOrders.slice(0, limit);
  }

  console.log(`Found ${orders.length} ${orderStatus || 'all-status'} orders (${dedupedOrders.length} unique orderNumbers). Targeting ${targetOrders.length}. Dry-run=${dryRun}${targetOrderNumber ? ` Order=${targetOrderNumber}` : ''}`);

  let updated = 0;
  let failed = 0;

  for (const order of targetOrders) {
    const payload = toCreateOrUpdatePayload(order, workbookByUpc, shipstationByUpc);

    if (dryRun) {
      console.log(`[DRY] ${order.orderNumber} => ${payload.carrierCode}/${payload.serviceCode}/${payload.packageCode}/${payload.confirmation}`);
      continue;
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/orders/createorder`, payload, { auth });
      updated += 1;
      console.log(`[OK] ${order.orderNumber} -> ${data.orderId}`);
    } catch (error) {
      const status = error.response?.status || '';
      const details = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      if (status === 400) {
        const retryPayload = toMinimalCreateOrUpdatePayload(order, workbookByUpc, shipstationByUpc);
        try {
          const retryResult = await axios.post(`${BASE_URL}/orders/createorder`, retryPayload, { auth });
          updated += 1;
          console.log(`[OK-RETRY] ${order.orderNumber} -> ${retryResult.data?.orderId}`);
          continue;
        } catch (retryError) {
          const retryStatus = retryError.response?.status || '';
          const retryDetails = retryError.response?.data
            ? JSON.stringify(retryError.response.data)
            : retryError.message;
          failed += 1;
          console.error(`[FAIL] ${order.orderNumber}: ${status} ${details}`);
          console.error(`[FAIL-RETRY] ${order.orderNumber}: ${retryStatus} ${retryDetails}`);
          continue;
        }
      }

      failed += 1;
      console.error(`[FAIL] ${order.orderNumber}: ${status} ${details}`);
    }
  }

  console.log(JSON.stringify({ dryRun, total: targetOrders.length, updated, failed }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
