const mongoose = require("mongoose");

const allorderSchema = new mongoose.Schema({
  orderID: { type: String },
  status: { type: String },
  
});

const AllordersModel = mongoose.model("all-orders", allorderSchema);

module.exports = { AllordersModel };
