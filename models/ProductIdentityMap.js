const mongoose = require("mongoose");

const productIdentityMapSchema = new mongoose.Schema(
  {
    upcNormalized: { type: String, required: true, unique: true, index: true },
    canonicalSku: { type: String, required: true },
    canonicalName: { type: String, required: true },
    source: {
      type: String,
      enum: ["admin", "featured", "shipstation", "manual", "bootstrap"],
      default: "bootstrap",
    },
    sourceProductId: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("product_identity_map", productIdentityMapSchema);
