require('dotenv').config();
const axios = require('axios');
const ProductIdentityMap = require('../models/ProductIdentityMap');
const SkuAliasMap = require('../models/SkuAliasMap');
const mongoose = require('mongoose');

const BASE_URL = 'https://ssapi.shipstation.com';

const auth = {
  username: process.env.SHIPSTATION_API_KEY,
  password: process.env.SHIPSTATION_API_SECRET,
};

function normalizeUpc(value) {
  return String(value || '').replace(/\D/g, '').trim();
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

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Missing MONGO_URI');
  if (!auth.username || !auth.password) throw new Error('Missing SHIPSTATION_API_KEY/SHIPSTATION_API_SECRET');

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const products = await getAllShipstationProducts();
    let updatedIdentity = 0;
    let insertedAlias = 0;

    for (const product of products) {
      const upc = normalizeUpc(product?.upc);
      if (!upc) continue;

      const sku = String(product?.sku || '').trim();
      const name = String(product?.name || product?.productName || '').trim();
      const productId = String(product?.productId || product?.productID || '').trim();

      await ProductIdentityMap.updateOne(
        { upcNormalized: upc },
        {
          $setOnInsert: {
            upcNormalized: upc,
            canonicalSku: upc,
            canonicalName: name || `UPC ${upc}`,
            source: 'shipstation',
            isActive: true,
          },
          $set: {
            'metadata.shipstationSku': sku,
            'metadata.shipstationProductName': name,
            'metadata.shipstationProductId': productId,
          },
        },
        { upsert: true }
      );
      updatedIdentity += 1;

      if (sku && sku !== upc) {
        await SkuAliasMap.updateOne(
          { aliasSku: sku, upcNormalized: upc },
          {
            $setOnInsert: {
              aliasSku: sku,
              upcNormalized: upc,
              source: 'shipstation',
              notes: 'Imported from ShipStation product catalog',
            },
          },
          { upsert: true }
        );
        insertedAlias += 1;
      }
    }

    console.log(JSON.stringify({
      totalShipstationProducts: products.length,
      updatedIdentity,
      insertedAlias,
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
