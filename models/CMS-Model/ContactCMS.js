const mongoose = require("mongoose");

const contactcmsSchema = new mongoose.Schema({
  about: { type: String },
  address: { type: String },
  email: { type: String },
  phone: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const ContactcmsModel = mongoose.model("contactcms", contactcmsSchema);

module.exports = { ContactcmsModel };
