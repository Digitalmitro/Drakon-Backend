const mongoose = require("mongoose");
const jwt = require('jsonwebtoken')

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

registeradminSchema.methods.generateAuthToken = async function () {
  try {
    // const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60);
    const expirationTime = process.env.expiry;
    let token = jwt.sign(
      { _id: this._id, expiresIn: expirationTime },
      process.env.secret_key
    );
    return token;
  } catch (e) {
    console.log(`Failed to generate token --> ${e}`);
  }
};

const RegisteradminModal = mongoose.model(
  "register admin",
  registeradminSchema
);

module.exports = { RegisteradminModal };
