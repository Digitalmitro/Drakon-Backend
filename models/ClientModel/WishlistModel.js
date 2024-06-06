const mongoose = require("mongoose");

const wishlistSchema = mongoose.Schema({
  image: [{
    type: String,
    required: true,
  }],
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
    type: Date,
    default: Date.now(),
  },
  product_id: {
    type: String,
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register client",
    required: true,
  },
});

const WishlistModal = mongoose.model("wishlist", wishlistSchema);

module.exports = { WishlistModal };
