const mongoose = require("mongoose");

const skuAliasMapSchema = new mongoose.Schema(
  {
    aliasSku: { type: String, required: true, index: true },
    upcNormalized: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ["order", "admin", "featured", "shipstation", "manual"],
      default: "order",
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

skuAliasMapSchema.index({ aliasSku: 1, upcNormalized: 1 }, { unique: true });

module.exports = mongoose.model("sku_alias_map", skuAliasMapSchema);
