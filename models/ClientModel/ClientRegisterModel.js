const mongoose = require("mongoose");

const registerclientSchema = mongoose.Schema({

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },
 
});

const RegisterclientModal = mongoose.model(
  "register client",
  registerclientSchema
);

module.exports = { RegisterclientModal };
