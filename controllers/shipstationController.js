const shipstationService = require('../services/shipstationService');
const { ProductsModal } = require('../models/AdminModel/ProductModel');
const Order = require('../models/Order');
const { XMLParser } = require('fast-xml-parser');
const { normalizeWeightUnits } = require('../utils/orderItemMapper');

// Helper to escape XML special characters
function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function requireShipstationBasicAuth(req, res) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="ShipStation"');
    res.status(401).send('Unauthorized');
    return false;
  }

  const base64creds = auth.split(' ')[1] || '';
  const creds = Buffer.from(base64creds, 'base64').toString('utf8');
  const [user, pass] = creds.split(':');

  const expectedUser = process.env.SHIPSTATION_USERNAME;
  const expectedPass = process.env.SHIPSTATION_PASSWORD;

  if (!expectedUser || !expectedPass || user !== expectedUser || pass !== expectedPass) {
    res.set('WWW-Authenticate', 'Basic realm="ShipStation"');
    res.status(401).send('Unauthorized');
    return false;
  }

  return true;
}

// Map internal statuses to ShipStation Custom Store statuses (case-sensitive)
function mapStatus({ paymentStatus, orderStatus, status }) {
  const paidStatus = process.env.SHIPSTATION_CUSTOMSTORE_PAID_STATUS || 'paid';
  const unpaidStatus = process.env.SHIPSTATION_CUSTOMSTORE_UNPAID_STATUS || 'unpaid';
  const shippedStatus = process.env.SHIPSTATION_CUSTOMSTORE_SHIPPED_STATUS || 'shipped';
  const cancelledStatus = process.env.SHIPSTATION_CUSTOMSTORE_CANCELLED_STATUS || 'cancelled';
  const onHoldStatus = process.env.SHIPSTATION_CUSTOMSTORE_ON_HOLD_STATUS || 'on_hold';

  const payment = paymentStatus ? String(paymentStatus).toLowerCase() : '';
  const order = orderStatus ? String(orderStatus).toLowerCase() : '';
  const legacy = status ? String(status).toLowerCase() : '';

  if (['paid', 'completed'].includes(payment)) return paidStatus;
  if (['shipped', 'delivered'].includes(order) || ['shipped', 'delivered'].includes(legacy)) return shippedStatus;
  if (['cancelled', 'canceled'].includes(order) || ['cancelled', 'canceled'].includes(legacy)) return cancelledStatus;
  if (['on_hold', 'on-hold', 'hold'].includes(order) || ['on_hold', 'on-hold', 'hold'].includes(legacy)) return onHoldStatus;
  return unpaidStatus;
}

// Format date for ShipStation XML: MM/dd/yyyy HH:mm (UTC)
function formatDateForShipstation(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    const yyyy = String(dt.getUTCFullYear());
    const HH = String(dt.getUTCHours()).padStart(2, '0');
    const MM = String(dt.getUTCMinutes()).padStart(2, '0');
    return `${mm}/${dd}/${yyyy} ${HH}:${MM}`;
  } catch (err) {
    return '';
  }
}

function formatMoney(value) {
  const num = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function parseShippingMethodConfig(order = {}) {
  const defaultCarrierCode = (process.env.SHIPSTATION_DEFAULT_CARRIER_CODE || 'stamps_com').trim();
  const defaultServiceCode = (process.env.SHIPSTATION_DEFAULT_SERVICE_CODE || '').trim();
  const defaultPackageCode = (process.env.SHIPSTATION_DEFAULT_PACKAGE_CODE || 'package').trim();
  const defaultConfirmation = (process.env.SHIPSTATION_DEFAULT_CONFIRMATION || 'none').trim();

  const raw = order?.shippingMethod ? String(order.shippingMethod).trim() : '';

  let carrierCode = defaultCarrierCode;
  let serviceCode = order?.customField1 ? String(order.customField1).trim() : defaultServiceCode;
  let packageCode = order?.customField2 ? String(order.customField2).trim() : defaultPackageCode;
  let confirmation = order?.customField3 ? String(order.customField3).trim() : defaultConfirmation;
  let requestedShippingService = raw;

  if (raw.includes('|')) {
    const [carrierRaw, serviceRaw, packageRaw, confirmationRaw] = raw.split('|').map((part) => (part || '').trim());
    carrierCode = carrierRaw || carrierCode;
    serviceCode = serviceRaw || serviceCode;
    packageCode = packageRaw || packageCode;
    confirmation = confirmationRaw || confirmation;
    requestedShippingService = serviceCode || requestedShippingService;
  }

  if (!requestedShippingService) {
    requestedShippingService = serviceCode || '';
  }

  return {
    carrierCode,
    serviceCode,
    packageCode,
    confirmation,
    requestedShippingService,
  };
}

function getItemSize(item = {}) {
  const direct = item.size ? String(item.size).trim() : '';
  if (direct) return direct;

  const options = item.options && typeof item.options === 'object' ? item.options : null;
  if (!options) return '';

  if (options instanceof Map) {
    const fromMap = options.get('Size') || options.get('size');
    return fromMap ? String(fromMap).trim() : '';
  }

  const fromObj = options.Size || options.size;
  return fromObj ? String(fromObj).trim() : '';
}

function withSizeInName(name = '', size = '') {
  const base = name ? String(name).trim() : '';
  const normalizedSize = size ? String(size).trim() : '';
  if (!normalizedSize || normalizedSize === 'One Size') return base;
  if (base.toLowerCase().endsWith(normalizedSize.toLowerCase())) return base;
  return `${base} ${normalizedSize}`.trim();
}
// GET /api/shipstation/orders
async function getOrdersForShipstation(req, res) {
  try {
    if (!requireShipstationBasicAuth(req, res)) return;

    // Fetch real orders from DB (no test fallback)
    const orders = await Order.find().lean();

    // Build XML
    const xmlPieces = [];
    xmlPieces.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlPieces.push('<Orders>');

    for (const o of orders) {
      const orderId = escapeXml(o._id || '');
      const orderNumber = escapeXml(o.orderNumber || o._id || '');
      const orderDateIso = o.orderDate ? formatDateForShipstation(o.orderDate) : formatDateForShipstation(new Date());
      const lastModifiedIso = o.lastModified ? formatDateForShipstation(o.lastModified) : orderDateIso;
      const status = mapStatus({
        paymentStatus: o.paymentStatus,
        orderStatus: o.orderStatus,
        status: o.status,
      });

      // Use billing and shipping from the Order model
      const billTo = o.billTo || {
        fullName: '',
        company: '',
        phone: '',
        email: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      };

      const shipTo = o.shipTo || {
        fullName: '',
        company: '',
        phone: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      };

      const items = Array.isArray(o.items) ? o.items : [];
      const shippingConfig = parseShippingMethodConfig(o);

      xmlPieces.push('  <Order>');
      xmlPieces.push(`    <OrderID>${orderId}</OrderID>`);
      xmlPieces.push(`    <OrderNumber>${orderNumber}</OrderNumber>`);
      xmlPieces.push(`    <OrderDate>${escapeXml(orderDateIso)}</OrderDate>`);
      xmlPieces.push(`    <LastModified>${escapeXml(lastModifiedIso)}</LastModified>`);
      xmlPieces.push(`    <OrderStatus>${escapeXml(status)}</OrderStatus>`);
      xmlPieces.push(`    <OrderTotal>${formatMoney(o.orderTotal)}</OrderTotal>`);
      xmlPieces.push(`    <ShippingAmount>${formatMoney(o.shippingAmount)}</ShippingAmount>`);
      xmlPieces.push(`    <TaxAmount>${formatMoney(o.taxAmount)}</TaxAmount>`);
      xmlPieces.push(`    <ShippingMethod>${escapeXml(shippingConfig.requestedShippingService || o.shippingMethod || '')}</ShippingMethod>`);
      xmlPieces.push(`    <PaymentMethod>${escapeXml(o.paymentMethod || '')}</PaymentMethod>`);
      xmlPieces.push(`    <CurrencyCode>${escapeXml(o.currencyCode || 'USD')}</CurrencyCode>`);
      xmlPieces.push(`    <CustomField1>${escapeXml(o.customField1 || '')}</CustomField1>`);
      xmlPieces.push(`    <CustomField2>${escapeXml(o.customField2 || '')}</CustomField2>`);
      xmlPieces.push(`    <CustomField3>${escapeXml(o.customField3 || '')}</CustomField3>`);

      xmlPieces.push('    <Customer>');
      xmlPieces.push(`      <CustomerCode>${escapeXml(o.customerCode || o.billTo?.email || o.shipTo?.email || o.orderNumber || o._id || '')}</CustomerCode>`);

      xmlPieces.push('      <BillTo>');
      xmlPieces.push(`        <Name>${escapeXml(billTo.fullName || '')}</Name>`);
      xmlPieces.push(`        <Company>${escapeXml(billTo.company || '')}</Company>`);
      xmlPieces.push(`        <Phone>${escapeXml(billTo.phone || '')}</Phone>`);
      xmlPieces.push(`        <Email>${escapeXml(billTo.email || '')}</Email>`);
      xmlPieces.push(`        <Address1>${escapeXml(billTo.address1 || '')}</Address1>`);
      xmlPieces.push(`        <Address2>${escapeXml(billTo.address2 || '')}</Address2>`);
      xmlPieces.push(`        <City>${escapeXml(billTo.city || '')}</City>`);
      xmlPieces.push(`        <State>${escapeXml(billTo.state || '')}</State>`);
      xmlPieces.push(`        <PostalCode>${escapeXml(billTo.postalCode || billTo.zip || '')}</PostalCode>`);
      xmlPieces.push(`        <Country>${escapeXml(billTo.country || '')}</Country>`);
      xmlPieces.push('      </BillTo>');

      xmlPieces.push('      <ShipTo>');
      xmlPieces.push(`        <Name>${escapeXml(shipTo.fullName || '')}</Name>`);
      xmlPieces.push(`        <Company>${escapeXml(shipTo.company || '')}</Company>`);
      xmlPieces.push(`        <Address1>${escapeXml(shipTo.address1 || '')}</Address1>`);
      xmlPieces.push(`        <Address2>${escapeXml(shipTo.address2 || '')}</Address2>`);
      xmlPieces.push(`        <City>${escapeXml(shipTo.city || '')}</City>`);
      xmlPieces.push(`        <State>${escapeXml(shipTo.state || '')}</State>`);
      xmlPieces.push(`        <PostalCode>${escapeXml(shipTo.postalCode || shipTo.zip || '')}</PostalCode>`);
      xmlPieces.push(`        <Country>${escapeXml(shipTo.country || '')}</Country>`);
      xmlPieces.push(`        <Phone>${escapeXml(shipTo.phone || '')}</Phone>`);
      xmlPieces.push('      </ShipTo>');
      xmlPieces.push('    </Customer>');

      xmlPieces.push('    <Items>');
      for (const it of items) {
        const size = getItemSize(it);
        const baseName = it.name || '';
        const computedName = withSizeInName(baseName, size);
        const sku = it.sku || it.SKU || computedName || '';
        const upc = it.upc || it.UPC || '';
        const itemOptions = [];
        if (size) itemOptions.push({ name: 'Size', value: size });
        if (upc) itemOptions.push({ name: 'UPC', value: upc });
        const quantity = it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 1);
        const unit = (typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.price === 'number' ? it.price : 0));
        const weightValue = Number.isFinite(Number(it.weight)) ? Number(it.weight) : 0;
        const weightUnits = normalizeWeightUnits(it.weightUnits);

        xmlPieces.push('      <Item>');
        xmlPieces.push(`        <SKU>${escapeXml(sku)}</SKU>`);
        xmlPieces.push(`        <Name>${escapeXml(computedName)}</Name>`);
        xmlPieces.push(`        <Quantity>${escapeXml(quantity)}</Quantity>`);
        xmlPieces.push(`        <UnitPrice>${escapeXml(Number(unit).toFixed(2))}</UnitPrice>`);
        xmlPieces.push(`        <Weight>${escapeXml(weightValue.toFixed(2))}</Weight>`);
        xmlPieces.push(`        <WeightUnits>${escapeXml(weightUnits)}</WeightUnits>`);
        if (itemOptions.length > 0) {
          xmlPieces.push('        <Options>');
          for (const option of itemOptions) {
            xmlPieces.push('          <Option>');
            xmlPieces.push(`            <Name>${escapeXml(option.name)}</Name>`);
            xmlPieces.push(`            <Value>${escapeXml(option.value)}</Value>`);
            xmlPieces.push('          </Option>');
          }
          xmlPieces.push('        </Options>');
        }
        xmlPieces.push('      </Item>');
      }
      xmlPieces.push('    </Items>');

      xmlPieces.push('  </Order>');
    }

    xmlPieces.push('</Orders>');

    const xml = xmlPieces.join('\n');
    res.set('Content-Type', 'application/xml');
    return res.status(200).send(xml);
  } catch (error) {
    // Never return JSON or stack traces — return 500 with minimal body
    console.error('ShipStation orders error:', error && (error.message || error));
    res.set('Content-Type', 'application/xml');
    res.set('WWW-Authenticate', 'Basic realm="ShipStation"');
    return res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><Orders></Orders>');
  }
}

// POST /api/shipstation/shipnotify
async function shipNotify(req, res) {
  try {
    if (!requireShipstationBasicAuth(req, res)) return;

    const xml = req.body;
    if (!xml || typeof xml !== 'string') {
      return res.status(400).send('Invalid ShipNotice payload');
    }

    const xmlParser = new XMLParser({ ignoreAttributes: false, cdataPropName: 'dat' });
    const json = xmlParser.parse(xml);
    const sn = json.ShipNotice;
    if (!sn || !sn.OrderNumber) {
      return res.status(400).send('Missing ShipNotice data');
    }

    await Order.findOneAndUpdate(
      { orderNumber: sn.OrderNumber },
      {
        orderStatus: 'Shipped',
        lastModified: sn.ShipDate ? new Date(sn.ShipDate) : new Date(),
        shippingMethod: `${sn.Carrier || ''}-${sn.Service || ''}`.replace(/^-/, ''),
        trackingNumber: sn.TrackingNumber,
      }
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error('ShipStation shipnotify error:', error && (error.message || error));
    return res.status(500).send('Shipnotify failed');
  }
}

async function getProductByUPC(req, res) {
  const upc = req.params.upc;
  if (!upc) return res.status(400).json({ error: 'UPC is required' });

  try {
    const product = await shipstationService.getProductByUPC(upc);
    res.json(product);
  } catch (error) {
    console.error('Controller getProductByUPC error:', error.message || error);
    res.status(500).json({ error: error.message || 'Failed to fetch product from ShipStation' });
  }
}

async function getShippingRates(req, res) {
  const { shipTo, shipFrom, packageInfo, carrierCode } = req.body;

  if (!shipTo || !packageInfo) {
    return res.status(400).json({ error: 'Missing required fields: shipTo and packageInfo' });
  }

  try {
    const rates = await shipstationService.getShippingRates({ shipTo, shipFrom, packageInfo, carrierCode });
    res.json(rates);
  } catch (error) {
    console.error('Controller getShippingRates error:', error.response?.data || error.message || error);
    res.status(500).json({ error: error.response?.data || error.message || 'Failed to get shipping rates' });
  }
}

async function getAllProducts(req, res) {
  try {
    // Fetch products from ShipStation SSAPI v1
    const products = await shipstationService.getAllProducts();

    // Normalize minimal UPC list for each product
    const result = products.map((p) => {
      const upcs = [];
      if (p.upc) upcs.push(p.upc);
      if (p.sku && !upcs.includes(p.sku)) upcs.push(p.sku);
      return { ...p, upcs };
    });

    res.json(result);
  } catch (error) {
    console.error('Controller getAllProducts error:', error.response?.data || error.message || error);
    res.status(500).json({ error: error.response?.data || error.message || 'Failed to fetch products from ShipStation' });
  }
}

module.exports = {
  getProductByUPC,
  getShippingRates,
  getAllProducts,
  getOrdersForShipstation,
  shipNotify,
};
