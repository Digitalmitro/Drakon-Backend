const mongoose = require("mongoose");

const featuredproductsSchema = mongoose.Schema({
  image: [
    {
      type: String,
      required: true,
    },
  ],
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
    required: true,
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
  stock: {
    type: Number,
    required: true,
  },
  isSoldOut: {
    type: Boolean,
    default: false,
  },
  soldOutSizes: {
    type: [String],
    default: [],
  },

  createdDate: {
    type: Date,
    default: Date.now(),
  },
});

const FeaturedpoductModal = mongoose.model(
  "featured-product",
  featuredproductsSchema
);

module.exports = { FeaturedpoductModal };
