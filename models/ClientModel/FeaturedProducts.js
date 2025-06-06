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
    type: [String],
    required: true,
  },
  weight: {
    type: Number, // unit: ounces
    required: true,
  },
  stock: {
    type: Number,
    required: true,
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
