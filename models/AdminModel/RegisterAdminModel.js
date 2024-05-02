const mongoose = require("mongoose");

const registeradminSchema = mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  contactcms: { type: mongoose.Schema.Types.ObjectId, ref: "contactcms" },
  footercms: { type: mongoose.Schema.Types.ObjectId, ref: "footercms" },
});

const RegisteradminModal = mongoose.model(
  "register admin",
  registeradminSchema
);

module.exports = { RegisteradminModal };
