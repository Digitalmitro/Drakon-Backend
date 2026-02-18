const mongoose = require("mongoose");

const productsSchema = mongoose.Schema({
  image: [
    {
      type: String,
      required: true,
    },
  ],
  category:  {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
  },
  size: {
    type: [
      {
        size: {
          type: String,
          required: true,
        },
        sku: {
          type: String,
          required: false,
        },
        upc: {
          type: String,
          required: false,
        },
        weight: {
          type: Number,
          required: false,
          default: 0,
        },
        weightUnits: {
          type: String,
          required: false,
          default: "Pounds",
        },
      },
    ],
    required: false,
  },
  hasNoSize: {
    type: Boolean,
    default: false,
  },
  upc: {
    type: String, // fallback for products with no size
    required: false,
  },
  sku: {
    type: String,
    required: false,
  },
  weight: {
    type: Number,
    required: false,
    default: 0,
  },
  weightUnits: {
    type: String,
    required: false,
    default: "Pounds",
  },
  isSoldOut: {
    type: Boolean,
    default: false,
  },
  soldOutSizes: {
    type: [String],
    default: [],
  },
  review: [
    {
      email: { type: String },
      rating: { type: Number },
      comments: { type: String },
    },
  ],
  createdDate: {
    type: Date,
    default: Date.now(),
  },
});

const ProductsModal = mongoose.model("products", productsSchema);

module.exports = { ProductsModal };
