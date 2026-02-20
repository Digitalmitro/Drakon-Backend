const mongoose = require("mongoose");

const quarantinedOrderItemSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, default: "" },
    reason: { type: String, required: true },
    upcRaw: { type: String, default: "" },
    upcNormalized: { type: String, default: "" },
    skuRaw: { type: String, default: "" },
    productName: { type: String, default: "" },
    size: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    source: { type: String, default: "order_create" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    resolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("quarantined_order_item", quarantinedOrderItemSchema);
