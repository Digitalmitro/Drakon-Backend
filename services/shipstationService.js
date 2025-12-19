const axios = require('axios');

const SHIPSTATION_API_URL = 'https://ssapi.shipstation.com';
const SHIPSTATION_API_KEY = process.env.SHIPSTATION_API_KEY;
const SHIPSTATION_API_SECRET = process.env.SHIPSTATION_API_SECRET;

// Helper to create Basic Auth header
const getAuthHeader = () => {
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
    const response = await axios.get(`${SHIPSTATION_API_URL}/products`, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      params: {
        upc: upc  // Search by UPC parameter
      }
    });

    if (response.data && response.data.products && response.data.products.length > 0) {
      return response.data.products[0];
    }
    
    throw new Error(`Product not found in ShipStation for UPC: ${upc}`);
  } catch (error) {
    console.error(`Error fetching product from ShipStation (UPC: ${upc}):`, error.message);
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

module.exports = {
  getProductByUPC,
  getShippingRates
};
