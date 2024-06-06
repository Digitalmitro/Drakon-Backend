const mongoose = require("mongoose");

const indexSchema = new mongoose.Schema({
  script: {
    src: String,
    type: { type: String },
    async: String,
    defer: String,
    integrity: String,
    crossorigin: String,
  },
  link: {
    href: String,
    rel: String,
    type: { type: String },
    media: String,
    sizes: String,
    crossorigin: String,
    as: String,
    integrity: String,
    title: String,
    hreflang: String,
  },
  meta: {
    name: String,
    content: String,
    charset: String,
    httpEquiv: String,
  },
  title: { type: String },

  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register admin",
    required: true,
  },
});

const IndexCMS = mongoose.model("indexCMS", indexSchema);

module.exports = IndexCMS;
