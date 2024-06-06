const mongoose = require("mongoose");

const addressbookBillingSchema = new mongoose.Schema({
  billingfirstName: { type: String },
  billinglastName: { type: String },
  billingcountry: { type: String, required: true },
  billingstreetAddress: { type: String },
  billingcity: { type: String },
  billingstate: { type: String },
  billingzipcode: { type: String, required: true },
  billingphone: { type: Number, required: true },
  billingemail: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register client",
    required: true,
  },
});

const AddressbookBillingModel = mongoose.model("addressbookbilling", addressbookBillingSchema);

module.exports = { AddressbookBillingModel };
