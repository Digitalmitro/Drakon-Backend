require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { enforceCanonicalOrderItems } = require("./canonicalIdentity");

function hasItemChanged(before = {}, after = {}) {
  return (
    String(before.sku || "") !== String(after.sku || "") ||
    String(before.upc || "") !== String(after.upc || "") ||
    String(before.name || "") !== String(after.name || "")
  );
}

async function run() {
  const applyChanges = process.argv.includes("--apply");

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const orders = await Order.find({}, { _id: 1, orderNumber: 1, items: 1 }).lean();

    let ordersScanned = 0;
    let ordersUpdated = 0;
    let itemsUpdated = 0;
    let itemsQuarantined = 0;

    for (const order of orders) {
      ordersScanned += 1;

      const { canonicalItems, quarantined } = await enforceCanonicalOrderItems(order.items || [], {
        orderNumber: order.orderNumber,
        source: "repair_orders_canonical",
      });

      itemsQuarantined += quarantined.length;

      const beforeItems = Array.isArray(order.items) ? order.items : [];
      const changedCount = Math.min(beforeItems.length, canonicalItems.length)
        ? canonicalItems.reduce((acc, item, idx) => acc + (hasItemChanged(beforeItems[idx], item) ? 1 : 0), 0)
        : 0;

      if (changedCount > 0 && canonicalItems.length > 0) {
        ordersUpdated += 1;
        itemsUpdated += changedCount;

        if (applyChanges) {
          await Order.updateOne(
            { _id: order._id },
            {
              $set: {
                items: canonicalItems,
                lastModified: new Date(),
              },
            }
          );
        }
      }
    }

    console.log("\n========== ORDER REPAIR (CANONICAL UPC) ==========");
    console.log(`Mode: ${applyChanges ? "APPLY" : "DRY_RUN"}`);
    console.log(`Orders scanned: ${ordersScanned}`);
    console.log(`Orders updated: ${ordersUpdated}`);
    console.log(`Items updated: ${itemsUpdated}`);
    console.log(`Items quarantined: ${itemsQuarantined}`);

    if (!applyChanges) {
      console.log("ℹ️ Dry-run complete. Re-run with --apply to persist updates.");
    } else {
      console.log("✅ Canonical repair complete.");
    }
  } catch (error) {
    console.error("❌ Canonical repair failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
