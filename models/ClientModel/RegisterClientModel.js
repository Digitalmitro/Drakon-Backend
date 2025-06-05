const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

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
  phone: {
    type: String,
  },
  zipcode: {
    type: String,
  },
  password: {
    type: String,
    required: true,
  },
  registerDate: {
    type: Date,
  },
  lastActive: {
    type: String,
  },
  addressbookbilling: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "addressbookbilling",
  },

  addressbookShipping: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "addressbookShipping",
  }],

  // accountdetail: { type: mongoose.Schema.Types.ObjectId, ref: "accountdetail" },
  // message: [{ type: mongoose.Schema.Types.ObjectId, ref: "message" }],
  // order: [{ type: mongoose.Schema.Types.ObjectId, ref: "order" }],
  // wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "wishlist" }],
});

// Hashing Passwords
registerclientSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
    // console.log(this.password);
  }
  next();
});

registerclientSchema.methods.generateAuthToken = async function () {
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

const RegisterclientModal = mongoose.model(
  "register client",
  registerclientSchema
);

module.exports = { RegisterclientModal };
