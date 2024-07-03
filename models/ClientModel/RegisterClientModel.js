const mongoose = require("mongoose");

const registerclientSchema = mongoose.Schema({
  firstName: {
    type: String,
  },
  lastName: {
    type: String,
  },
  displayName: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  registerDate: {
    type: String,
  },
  lastActive: {
    type: String,
  },
  addressbookbilling: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "addressbookbilling",
  },

  addressbookShipping: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "addressbookShipping",
  },

  accountdetail: { type: mongoose.Schema.Types.ObjectId, ref: "accountdetail" },
  message: { type: mongoose.Schema.Types.ObjectId, ref: "message" },
  order: [{ type: mongoose.Schema.Types.ObjectId, ref: "order" }],
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "wishlist" }],
});

const RegisterclientModal = mongoose.model(
  "register client",
  registerclientSchema
);

module.exports = { RegisterclientModal };
