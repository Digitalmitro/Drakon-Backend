const mongoose = require("mongoose");

const navItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    path: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const headerSchema = new mongoose.Schema(
  {
    logo: { type: String, default: "" },
    navItems: {
      type: [navItemSchema],
      default: [],
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "register admin",
      required: true,
    },
  },
  { timestamps: true }
);

const HeaderCMS = mongoose.model("HeaderCMS", headerSchema);

module.exports = HeaderCMS;
