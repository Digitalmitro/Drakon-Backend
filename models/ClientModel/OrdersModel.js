const mongoose = require("mongoose");

const ordersSchema = mongoose.Schema({
  image: [
    {
      type: String,
      required: true,
    },
  ],
  user: {
    type: String,
  },
  ip: {
    type: String,
  },
  billing: {
    type: Object,
  },
  shipping: {
    type: Object,
  },
  title: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  qty: {
    type: Number,
    required: true,
  },
  createdDate: {
    type: String,
  },
  product_id: {
    type: String,
    required: true,
  },
  status: {
    type: String,
  },
  totalpay: {
    type: Number,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register client",
    required: true,
  },
});

const OrderModal = mongoose.model("order", ordersSchema);

module.exports = { OrderModal };
