const mongoose = require("mongoose");

const blogcmsSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description1: { type: String },

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const BlogcmsModel = mongoose.model("blogcms", blogcmsSchema);

module.exports = { BlogcmsModel };
