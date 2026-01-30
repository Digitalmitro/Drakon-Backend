const shipstationService = require('../services/shipstationService');
const { ProductsModal } = require('../models/AdminModel/ProductModel');
const Order = require('../models/Order');

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

// Map internal statuses to ShipStation-supported statuses
function mapStatus(internal) {
  if (!internal) return 'unpaid';
  const s = String(internal).toLowerCase();
  if (['paid', 'completed'].includes(s)) return 'paid';
  if (['shipped', 'delivered'].includes(s)) return 'shipped';
  if (['cancelled', 'canceled'].includes(s)) return 'cancelled';
  if (['on_hold', 'on-hold', 'hold'].includes(s)) return 'on_hold';
  return 'unpaid';
}

// Format date for ShipStation XML: remove milliseconds and timezone
function formatDateForShipstation(d) {
  if (!d) return '';
  try {
    const iso = new Date(d).toISOString();
    // Remove fractional seconds and timezone
    // e.g. 2025-06-01T08:54:17.888Z -> 2025-06-01T08:54:17
    return iso.replace(/\.\d+Z$/, '');
  } catch (err) {
    return '';
  }
}
// GET /api/shipstation/orders
async function getOrdersForShipstation(req, res) {
  try {
    // Basic Auth
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Basic ')) {
      res.set('WWW-Authenticate', 'Basic realm="ShipStation"');
      return res.status(401).send('Unauthorized');
    }

    const base64creds = auth.split(' ')[1] || '';
    const creds = Buffer.from(base64creds, 'base64').toString('utf8');
    const [user, pass] = creds.split(':');

    const expectedUser = process.env.SHIPSTATION_USERNAME;
    const expectedPass = process.env.SHIPSTATION_PASSWORD;

    if (!expectedUser || !expectedPass || user !== expectedUser || pass !== expectedPass) {
      res.set('WWW-Authenticate', 'Basic realm="ShipStation"');
      return res.status(401).send('Unauthorized');
    }

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
      const status = mapStatus(o.orderStatus || o.paymentStatus || o.status);

      // Use shipTo from the Order model; fall back to empty fields if missing
      const shipTo = o.shipTo || {
        fullName: '',
        company: '',
        address1: '',
        address2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      };

      const items = Array.isArray(o.items) ? o.items : [];

      xmlPieces.push('  <Order>');
      xmlPieces.push(`    <OrderID>${orderId}</OrderID>`);
      xmlPieces.push(`    <OrderNumber>${orderNumber}</OrderNumber>`);
      xmlPieces.push(`    <OrderDate>${escapeXml(orderDateIso)}</OrderDate>`);
      xmlPieces.push(`    <LastModified>${escapeXml(lastModifiedIso)}</LastModified>`);
      xmlPieces.push(`    <OrderStatus>${escapeXml(status)}</OrderStatus>`);

      xmlPieces.push('    <ShipTo>');
      xmlPieces.push(`      <Name>${escapeXml(shipTo.fullName || '')}</Name>`);
      xmlPieces.push(`      <Company>${escapeXml(shipTo.company || '')}</Company>`);
      xmlPieces.push(`      <Street1>${escapeXml(shipTo.address1 || '')}</Street1>`);
      xmlPieces.push(`      <Street2>${escapeXml(shipTo.address2 || '')}</Street2>`);
      xmlPieces.push(`      <City>${escapeXml(shipTo.city || '')}</City>`);
      xmlPieces.push(`      <State>${escapeXml(shipTo.state || '')}</State>`);
      xmlPieces.push(`      <PostalCode>${escapeXml(shipTo.postalCode || shipTo.zip || '')}</PostalCode>`);
      xmlPieces.push(`      <Country>${escapeXml(shipTo.country || '')}</Country>`);
      xmlPieces.push('    </ShipTo>');

      xmlPieces.push('    <Items>');
      for (const it of items) {
        xmlPieces.push('      <Item>');
        xmlPieces.push(`        <SKU>${escapeXml(it.sku || it.SKU || '')}</SKU>`);
        xmlPieces.push(`        <Name>${escapeXml(it.name || '')}</Name>`);
        xmlPieces.push(`        <Quantity>${escapeXml(it.quantity != null ? it.quantity : (it.qty != null ? it.qty : 1))}</Quantity>`);
        const unit = (typeof it.unitPrice === 'number' ? it.unitPrice : (typeof it.price === 'number' ? it.price : 0));
        xmlPieces.push(`        <UnitPrice>${escapeXml(Number(unit).toFixed(2))}</UnitPrice>`);
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
};
