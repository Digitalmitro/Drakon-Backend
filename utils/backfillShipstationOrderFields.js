require('dotenv').config({ path: '/Users/soumikadas/SourceCodes/Drakon/Drakon-Backend/.env' });
const mongoose = require('mongoose');
const Order = require('../models/Order');

function mapServiceCodeFromShippingMethod(shippingMethod = '') {
  const value = String(shippingMethod || '').trim();
  if (!value) return '';

  if (value.includes('|')) {
    const [, serviceCode] = value.split('|').map((part) => String(part || '').trim());
    return serviceCode || '';
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('priority')) return 'usps_priority';
  if (normalized.includes('ground')) return 'usps_ground_advantage';
  if (normalized.includes('first')) return 'usps_first_class_mail';
  return '';
}

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error('Missing MONGO_URI in environment');
  }

  await mongoose.connect(process.env.MONGO_URI);

  const cursor = Order.find({
    $or: [
      { customField1: { $exists: false } },
      { customField1: '' },
      { customField2: { $exists: false } },
      { customField2: '' },
      { customField3: { $exists: false } },
      { customField3: '' },
    ],
  }).cursor();

  let scanned = 0;
  let modified = 0;
  let skipped = 0;

  for await (const order of cursor) {
    scanned += 1;

    const serviceCode = order.customField1 || mapServiceCodeFromShippingMethod(order.shippingMethod);
    const packageCode = order.customField2 || 'package';
    const confirmation = order.customField3 || 'none';

    const changes = {};
    if (!order.customField1 && serviceCode) changes.customField1 = serviceCode;
    if (!order.customField2 && packageCode) changes.customField2 = packageCode;
    if (!order.customField3 && confirmation) changes.customField3 = confirmation;

    if (!Object.keys(changes).length) {
      skipped += 1;
      continue;
    }

    await Order.updateOne({ _id: order._id }, { $set: changes });
    modified += 1;
  }

  console.log(JSON.stringify({ scanned, modified, skipped }, null, 2));

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error.message);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
