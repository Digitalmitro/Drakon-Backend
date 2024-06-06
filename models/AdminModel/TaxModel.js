const mongoose = require("mongoose");

const taxSchema = new mongoose.Schema({
  rate: {
    type: Number,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const Tax = mongoose.model("Tax", taxSchema);

module.exports = Tax;
