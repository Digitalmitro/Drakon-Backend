const mongoose = require("mongoose");

const registeradminSchema = mongoose.Schema({
  name: {
    type: String,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: Number,
    // required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
  },
  coupon: [{ type: mongoose.Schema.Types.ObjectId, ref: "coupon" }],

  FooterCMS: { type: mongoose.Schema.Types.ObjectId, ref: "FooterCMS" },
  LogoCMS: { type: mongoose.Schema.Types.ObjectId, ref: "LogoCMS" },
  Tax: { type: mongoose.Schema.Types.ObjectId, ref: "Tax" },
  indexCMS: [{ type: mongoose.Schema.Types.ObjectId, ref: "indexCMS" }],
  blogcms: [{ type: mongoose.Schema.Types.ObjectId, ref: "blogcms" }],
  general: { type: mongoose.Schema.Types.ObjectId, ref: "general" },
});

const RegisteradminModal = mongoose.model(
  "register admin",
  registeradminSchema
);

module.exports = { RegisteradminModal };
