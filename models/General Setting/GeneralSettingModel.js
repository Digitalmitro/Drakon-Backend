const mongoose = require("mongoose");

const genaralSchema = new mongoose.Schema({
  address: {
    type: String,
  },
  country: [
    {
      name: String,
      id: String,
    },
  ],
  state: {
    type: String,
  },
  city: {
    type: String,
  },
  zip: {
    type: String,
  },
  nonSellingLocation: {
    type: [String], // Array of strings
    default: [], // Default to an empty array
  },
  EnableTax: {
    type: Boolean,
  },
  EnableCoupon: {
    type: Boolean,
  },
  Currency: {
    type: String,
  },
  EnableReview: {
    type: Boolean,
  },
  EnableRating: {
    type: Boolean,
  },
  TaxRate: {
    type: Number,
  },
  ShippingState: [
    {
      state: String,
      charges: String,
    },
  ],
  CashOnDelivery: {
    type: Boolean,
  },
  paypal: {
    type: Boolean,
  },
  stripe: {
    type: Boolean,
  },
  authorizeNet: {
    type: Boolean,
  },
  orderWithoutLogin: {
    type: Boolean,
  },
  logExixtAccInCheckout: {
    type: Boolean,
  },
  registerAccInCheckout: {
    type: Boolean,
  },
  createAccount: {
    type: Boolean,
  },
  sentLinkToReset: {
    type: Boolean,
  },
  deleteUserIDFromOrder: {
    type: Boolean,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const GenaralSetting = mongoose.model("general", genaralSchema);

module.exports = GenaralSetting;
