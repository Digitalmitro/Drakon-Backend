require('dotenv').config();
const axios = require('axios');

// Test ShipStation API connection
async function testShipStation() {
  const API_KEY = process.env.SHIPSTATION_API_KEY;
  const API_SECRET = process.env.SHIPSTATION_API_SECRET;

  if (!API_KEY || !API_SECRET) {
    console.error('❌ Missing SHIPSTATION_API_KEY or SHIPSTATION_API_SECRET in .env file');
    process.exit(1);
  }

  console.log('Testing ShipStation API connection...\n');
  console.log('API Key:', API_KEY);
  console.log('API Secret:', API_SECRET);
  
  const credentials = Buffer.from(`${API_KEY}:${API_SECRET}`).toString('base64');
  const authHeader = `Basic ${credentials}`;
  
  console.log('\nAuth String:', `${API_KEY}:${API_SECRET}`);
  console.log('Base64 Encoded:', credentials);
  console.log('Authorization Header:', authHeader + '\n');

  // Test 1: Get Carriers (simple test to verify authentication)
  try {
    console.log('Test 1: Fetching carriers list...');
    const carriersResponse = await axios.get('https://ssapi.shipstation.com/carriers', {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ Authentication successful!');
    console.log(`Found ${carriersResponse.data.length} carriers\n`);
  } catch (error) {
    console.error('❌ Authentication failed:', error.response?.data || error.message);
    process.exit(1);
  }

  // Test 2: Get shipping rates
  try {
    console.log('Test 2: Getting shipping rates...');
    const ratesData = {
      carrierCode: 'usps',
      serviceCode: null,
      packageCode: null,
      fromPostalCode: process.env.SHIPSTATION_FROM_ZIP || '10001',
      toState: 'CA',
      toCountry: 'US',
      toPostalCode: '90210',
      toCity: 'Beverly Hills',
      weight: {
        value: 16,
        units: 'ounces'
      },
      dimensions: {
        units: 'inches',
        length: 10,
        width: 8,
        height: 4
      },
      confirmation: 'none',
      residential: true
    };

    console.log('Request data:', JSON.stringify(ratesData, null, 2));

    const ratesResponse = await axios.post(
      'https://ssapi.shipstation.com/shipments/getrates',
      ratesData,
      {
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ Shipping rates retrieved successfully!\n');
    console.log('Available rates:');
    ratesResponse.data.forEach(rate => {
      const totalCost = (rate.shipmentCost || 0) + (rate.otherCost || 0);
      console.log(`  - ${rate.serviceName}: $${totalCost.toFixed(2)}`);
    });
  } catch (error) {
    console.error('\n❌ Failed to get rates:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }

  console.log('\n🎉 All tests passed! ShipStation integration is working correctly.');
}

testShipStation();
