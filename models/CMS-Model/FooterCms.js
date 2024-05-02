const mongoose = require("mongoose");

const footercmsSchema = new mongoose.Schema({
  OfficeAddress1: { type: String },
  OfficeAddress2: { type: String },
  MailAddress1: { type: String },
  MailAddress2: { type: String },
  MapEmbededUrl: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const FootercmsModel = mongoose.model("footercms", footercmsSchema);

module.exports = { FootercmsModel };
