const mongoose = require("mongoose");
require('dotenv').config()
console.log(process.env.mongo_url)
const connect = mongoose.connect(process.env.mongo_url);

module.exports = { connect };
