const mongoose = require("mongoose");

const inventoryproductsSchema = mongoose.Schema({
    image: {
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
          email: { type: String, unique: true },
          rating: { type: Number },
          comments: { type: String },
        },
      ],
      createdDate: {
        type: Date,
        default: Date.now(),
      },
});

const InventoryroductModal = mongoose.model("inventory-product", inventoryproductsSchema);

module.exports = { InventoryroductModal };
