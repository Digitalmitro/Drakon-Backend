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
