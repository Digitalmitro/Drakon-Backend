const mongoose = require("mongoose");

const syncAuditLogSchema = new mongoose.Schema(
  {
    entityType: { type: String, required: true },
    entityKey: { type: String, required: true, index: true },
    action: { type: String, required: true },
    status: {
      type: String,
      enum: ["success", "warning", "error"],
      required: true,
      default: "success",
    },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("sync_audit_log", syncAuditLogSchema);
