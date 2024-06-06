const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
  couponName: { type: String },
  discount: { type: Number },
  status: { type: String },
  limit: { type: Number },
  expiryDate: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const CouponModel = mongoose.model("coupon", couponSchema);

module.exports = { CouponModel };
