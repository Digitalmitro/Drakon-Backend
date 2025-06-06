// models/Order.js
const mongoose = require("mongoose");

// Address sub-schema (no _id)
const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    company: { type: String },
    phone: { type: String },
    email: { type: String },
    address1: { type: String, required: true },
    address2: { type: String },
    city: { type: String, required: true },
    state: { type: String },
    postalCode: { type: String, required: true },
    country: { type: String, required: true },
  },
  { _id: false }
);

// Item sub-schema (no _id)
const itemSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: String, required: true, }, // e.g. "M", "L", "XL"
    weight: { type: Number, required: true, }, // e.g. "M", "L", "XL"
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true },
    options: { type: Map, of: String },
    location: { type: String },
  },
  { _id: false }
);

// Main Order schema
const orderSchema = new mongoose.Schema(
  {
    // Identifiers & dates
    orderNumber: { type: String, required: true, unique: true, maxlength: 50 },
    orderDate: { type: Date, required: true },
    lastModified: { type: Date, default: Date.now },

    // Internal reference
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "register client" },

    // Customer & addresses
    customerCode: { type: String }, // e.g. email or external ID
    billTo: { type: addressSchema, required: true },
    shipTo: { type: addressSchema, required: true },

    // Line items & pricing
    items: { type: [itemSchema], required: true },
    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, default: 0 },
    shippingAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    orderTotal: { type: Number, required: true },
    currencyCode: { type: String, required: true, default: "USD" },

    // Shipping & payment details
    shippingMethod: { type: String }, // e.g. "USPSPriorityMail"
    paymentMethod: {
      type: String,
      enum: ["Credit Card", "PayPal", "Cash on Delivery", "Stripe"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    orderStatus: {
      type: String,
      enum: ["Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Processing",
    },

    // Notes, gifts & custom fields
    customerNotes: { type: String },
    internalNotes: { type: String },
    gift: { type: Boolean, default: false },
    giftMessage: { type: String },
    customField1: { type: String },
    customField2: { type: String },
    customField3: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
