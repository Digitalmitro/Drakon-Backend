const mongoose = require("mongoose");

const connect = mongoose.connect(
  `mongodb+srv://Tirtho:Tirtho@cluster0.4etk1hs.mongodb.net/DRAKON-Backend?retryWrites=true&w=majority`
);

module.exports = { connect };
