require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'https://ssapi.shipstation.com';

const auth = {
  username: process.env.SHIPSTATION_API_KEY,
  password: process.env.SHIPSTATION_API_SECRET,
};

function normalizeLower(value) {
  return String(value || '').trim().toLowerCase();
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

function toCreateOrUpdatePayload(order) {
  const mapped = mapShipment(order);
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
    items: (order.items || []).map((item) => ({
      lineItemKey: item.lineItemKey || String(item.orderItemId || ''),
      sku: item.sku || '',
      name: item.name || 'Item',
      quantity: item.quantity || 1,
      unitPrice: Number(item.unitPrice || 0),
      weight: item.weight || undefined,
      upc: item.upc || undefined,
    })),
    amountPaid: Number(order.amountPaid || 0),
    taxAmount: Number(order.taxAmount || 0),
    shippingAmount: Number(order.shippingAmount || 0),
    paymentMethod: order.paymentMethod || 'Stripe',
    requestedShippingService: order.requestedShippingService || 'USPS Priority Mail',
    carrierCode: mapped.carrierCode,
    serviceCode: mapped.serviceCode,
    packageCode: mapped.packageCode,
    confirmation: mapped.confirmation,
    weight: order.weight || { value: 1, units: 'pounds' },
    dimensions: order.dimensions || { units: 'inches', length: 10, width: 8, height: 4 },
    advancedOptions: {
      ...(order.advancedOptions || {}),
      customField1: order?.advancedOptions?.customField1 || order?.customField1 || mapped.serviceCode,
      customField2: order?.advancedOptions?.customField2 || order?.customField2 || mapped.packageCode,
      customField3: order?.advancedOptions?.customField3 || order?.customField3 || mapped.confirmation,
    },
  };
}

async function getAllAwaitingShipmentOrders() {
  const all = [];
  let page = 1;
  const pageSize = 500;

  while (true) {
    const { data } = await axios.get(`${BASE_URL}/orders`, {
      auth,
      params: { page, pageSize, orderStatus: 'awaiting_shipment' },
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
  const limitArg = process.argv.find((arg) => arg.startsWith('--limit='));
  const orderArg = process.argv.find((arg) => arg.startsWith('--order='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : null;
  const targetOrderNumber = orderArg ? String(orderArg.split('=')[1] || '').trim() : '';

  const orders = await getAllAwaitingShipmentOrders();
  let targetOrders = orders;
  if (targetOrderNumber) {
    targetOrders = orders.filter((order) => String(order.orderNumber || '').trim() === targetOrderNumber);
  }
  if (Number.isFinite(limit) && limit > 0) {
    targetOrders = targetOrders.slice(0, limit);
  }

  console.log(`Found ${orders.length} awaiting_shipment orders. Targeting ${targetOrders.length}. Dry-run=${dryRun}${targetOrderNumber ? ` Order=${targetOrderNumber}` : ''}`);

  let updated = 0;
  let failed = 0;

  for (const order of targetOrders) {
    const payload = toCreateOrUpdatePayload(order);

    if (dryRun) {
      console.log(`[DRY] ${order.orderNumber} => ${payload.carrierCode}/${payload.serviceCode}/${payload.packageCode}/${payload.confirmation}`);
      continue;
    }

    try {
      const { data } = await axios.post(`${BASE_URL}/orders/createorder`, payload, { auth });
      updated += 1;
      console.log(`[OK] ${order.orderNumber} -> ${data.orderId}`);
    } catch (error) {
      failed += 1;
      const status = error.response?.status || '';
      const details = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      console.error(`[FAIL] ${order.orderNumber}: ${status} ${details}`);
      if (status === 400) {
        console.error('[FAIL-PAYLOAD]', JSON.stringify({
          orderNumber: payload.orderNumber,
          orderId: payload.orderId,
          carrierCode: payload.carrierCode,
          serviceCode: payload.serviceCode,
          packageCode: payload.packageCode,
          confirmation: payload.confirmation,
          requestedShippingService: payload.requestedShippingService,
        }));
      }
    }
  }

  console.log(JSON.stringify({ dryRun, total: targetOrders.length, updated, failed }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
