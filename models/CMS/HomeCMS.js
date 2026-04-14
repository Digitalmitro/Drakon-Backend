const mongoose = require("mongoose");

const homeSchema = new mongoose.Schema(
  {
    announcementBar: {
      text: { type: String, default: "" },
      linkText: { type: String, default: "" },
      linkUrl: { type: String, default: "" },
    },
    promoSection: {
      title: { type: String, default: "" },
      description1: { type: String, default: "" },
      description2: { type: String, default: "" },
      buttonText: { type: String, default: "" },
      buttonUrl: { type: String, default: "" },
    },
    heroSection: {
      title: { type: String, default: "" },
      buttonText: { type: String, default: "" },
      buttonUrl: { type: String, default: "" },
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "register admin",
      required: true,
    },
  },
  { timestamps: true }
);

const HomeCMS = mongoose.model("HomeCMS", homeSchema);

module.exports = HomeCMS;
