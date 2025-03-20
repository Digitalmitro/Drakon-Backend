const mongoose = require("mongoose");

const topCategorySchema = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Cloudinary URL
  createdAt: { type: Date, default: Date.now }
});

const TopCategory = mongoose.model("TopCategory", topCategorySchema);
module.exports = TopCategory;
