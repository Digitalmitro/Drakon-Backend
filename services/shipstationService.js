const axios = require('axios');

const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

function normalizeUpc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D/g, "").trim();
}

function isLikelyUpcSku(value) {
  const normalized = normalizeUpc(value);
  return !!normalized && normalized.length >= 8 && normalized === String(value || '').trim();
}

function scoreShipstationProduct(product = {}) {
  let score = 0;

  if (product?.active !== false) score += 100;

  const weightOz = Number(product?.weightOz || 0);
  if (weightOz > 0) score += 20;

  const length = Number(product?.length || 0);
  const width = Number(product?.width || 0);
  const height = Number(product?.height || 0);
  if (length > 0 && width > 0 && height > 0) score += 20;

  if (String(product?.defaultServiceCode || '').trim()) score += 8;
  if (String(product?.defaultPackageCode || '').trim()) score += 8;
  if (String(product?.defaultCarrierCode || '').trim()) score += 8;

  const sku = String(product?.sku || '').trim();
  if (sku && !isLikelyUpcSku(sku)) score += 15;

  return score;
}

function pickBestProduct(products = []) {
  if (!Array.isArray(products) || products.length === 0) return null;
  return [...products].sort((left, right) => scoreShipstationProduct(right) - scoreShipstationProduct(left))[0];
}

// Helper to create Basic Auth header
const getAuthHeader = () => {
  if (!SHIPSTATION_API_KEY || !SHIPSTATION_API_SECRET) {
    throw new Error('Missing ShipStation API credentials. Set SHIPSTATION_API_KEY and SHIPSTATION_API_SECRET.');
  }
  const credentials = Buffer.from(`${SHIPSTATION_API_KEY}:${SHIPSTATION_API_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
};

/**
 * Get product details from ShipStation by UPC
 * @param {string} upc - The UPC code
 * @returns {Promise<Object>} Product details including weight and dimensions
 */
async function getProductByUPC(upc) {
  try {
    const normalizedUpc = normalizeUpc(upc);
    if (!normalizedUpc) {
      throw new Error("Invalid UPC supplied for ShipStation lookup");
    }

    const authHeader = getAuthHeader();
    const response = await axios.get(`${SHIPSTATION_API_URL}/products`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      params: {
        upc: normalizedUpc
      }
    });

    if (response.data && response.data.products && response.data.products.length > 0) {
      return response.data.products[0];
    }
    
    throw new Error(`Product not found in ShipStation for UPC: ${normalizedUpc}`);
  } catch (error) {
    console.error(error.response?.data || error.message);
    throw error;
  }
}

async function getBestProductByUPC(upc) {
  try {
    const normalizedUpc = normalizeUpc(upc);
    if (!normalizedUpc) {
      throw new Error("Invalid UPC supplied for ShipStation lookup");
    }

    const authHeader = getAuthHeader();
    const response = await axios.get(`${SHIPSTATION_API_URL}/products`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      },
      params: {
        upc: normalizedUpc
      }
    });

    const products = response.data?.products || [];
    const best = pickBestProduct(products);
    if (best) return best;

    throw new Error(`Product not found in ShipStation for UPC: ${normalizedUpc}`);
  } catch (error) {
    console.error(error.response?.data || error.message);
    throw error;
  }
}

/**
 * Calculate shipping rates using ShipStation API
 * @param {Object} params - Shipping parameters
 * @param {Object} params.shipTo - Destination address
 * @param {Object} params.shipFrom - Origin address (optional, will use default warehouse)
 * @param {Object} params.packageInfo - Package weight and dimensions
 * @param {string} params.carrierCode - Carrier code (optional, defaults to usps)
 * @returns {Promise<Array>} Array of shipping rates
 */
async function getShippingRates({ shipTo, shipFrom, packageInfo, carrierCode = 'stamps_com' }) {
  try {
    // Use provided shipFrom or default to warehouse from env
    const origin = shipFrom || {
      postalCode: process.env.SS_FROM_ZIP || '77328',
      city: process.env.SS_FROM_CITY || 'Cleveland',
      state: process.env.SS_FROM_STATE || 'CA',
      country: 'US'
    };

    
    const shipmentData = {
      carrierCode: carrierCode,
      serviceCode: null,  // null to get all available services
      packageCode: null,  // null to use custom dimensions
      fromPostalCode: origin.postalCode,
      fromCity: origin.city,
      fromState: origin.state,
      toState: shipTo.state,
      toCountry: shipTo.country || 'US',
      toPostalCode: shipTo.postalCode,
      toCity: shipTo.city,
      weight: {
        value: packageInfo.weight || 10,  // default 10 oz if not provided
        units: 'ounces'
      },
      dimensions: {
        length: packageInfo.length || 10,
        width: packageInfo.width || 8,
        height: packageInfo.height || 4,
        units: 'inches'
      },
      confirmation: 'none',
      residential: true
    };

    console.log('Getting rates with shipment data:', JSON.stringify(shipmentData, null, 2));

    // Get rates from ShipStation
    const response = await axios.post(
      `${SHIPSTATION_API_URL}/shipments/getrates`,
      shipmentData,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error getting shipping rates:', error.response?.data || error.message);
    throw error;
  }
}

async function createProduct(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid ShipStation product payload');
  }

  try {
    const response = await axios.post(
      `${SHIPSTATION_API_URL}/products/createproduct`,
      payload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error creating ShipStation product:', error.response?.data || error.message || error);
    throw error;
  }
}

async function updateProduct(productId, payload) {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) {
    throw new Error('Invalid ShipStation productId for update');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid ShipStation update payload');
  }

  try {
    const updatePayload = {
      ...payload,
      productId: Number.isFinite(Number(normalizedProductId)) ? Number(normalizedProductId) : normalizedProductId,
    };

    const response = await axios.put(
      `${SHIPSTATION_API_URL}/products/${encodeURIComponent(normalizedProductId)}`,
      updatePayload,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Error updating ShipStation product:', error.response?.data || error.message || error);
    throw error;
  }
}

async function deleteProduct(productId) {
  const normalizedProductId = String(productId || '').trim();
  if (!normalizedProductId) {
    throw new Error('Invalid ShipStation productId for deletion');
  }

  const headers = {
    'Authorization': getAuthHeader(),
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.delete(
      `${SHIPSTATION_API_URL}/products/${encodeURIComponent(normalizedProductId)}`,
      { headers }
    );
    return response.data;
  } catch (error) {
    try {
      const response = await axios.post(
        `${SHIPSTATION_API_URL}/products/deleteproduct`,
        { productId: normalizedProductId },
        { headers }
      );
      return response.data;
    } catch (fallbackError) {
      console.error('Error deleting ShipStation product:', fallbackError.response?.data || fallbackError.message || fallbackError);
      throw fallbackError;
    }
  }
}

module.exports = {
  getProductByUPC,
  getBestProductByUPC,
  getShippingRates,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  pickBestProduct,
};

/**
 * List products from ShipStation (SSAPI v1)
 * Will page through results until no more products or safety limit reached.
 * @param {Object} options
 * @param {number} options.pageSize
 */
async function getAllProducts({ pageSize = 100 } = {}) {
  try {
    const authHeader = getAuthHeader();
    let page = 1;
    const all = [];

    // Loop and accumulate pages. Safety cap to avoid infinite loops.
    while (page <= 50) {
      const response = await axios.get(`${SHIPSTATION_API_URL}/products`, {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        params: {
          page,
          pageSize
        }
      });

      const items = response.data && (response.data.products || response.data);
      if (!items || items.length === 0) break;

      all.push(...items);

      // If fewer than pageSize returned, we've reached the last page
      if (items.length < pageSize) break;
      page += 1;
    }

    return all;
  } catch (error) {
    console.error('Error listing ShipStation products:', error.response?.data || error.message || error);
    throw error;
  }
}
