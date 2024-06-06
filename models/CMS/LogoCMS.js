const mongoose = require("mongoose");

const logoSchema = new mongoose.Schema({
  image: {
    type: String,
  },

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const LogoCMS = mongoose.model("LogoCMS", logoSchema);

module.exports = LogoCMS;
