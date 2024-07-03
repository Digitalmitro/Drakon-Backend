const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  message: { type: String },
  date: { type: String },
  status: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register client",
    required: true,
  },
});

const MessageModel = mongoose.model("message", MessageSchema);

module.exports = { MessageModel };
