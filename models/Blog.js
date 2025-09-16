const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    tags: {
      type: [String], // array of tags
      default: [],
    },
    image: {
      type: String, // URL of the uploaded image
      default: "",
    },
    // linkingAnchor: {
    //   type: String,
    //   default: "",
    // },
    metaTitle: {
      type: String,
      default: "",
    },
    metaDescription: {
      type: String,
      default: "",
    },
    focusKeyword: {
      type: String,
      default: "",
    },
    slug: {
      type: String,
      required: true,
      unique: true, // ensures no two blogs have the same slug
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
