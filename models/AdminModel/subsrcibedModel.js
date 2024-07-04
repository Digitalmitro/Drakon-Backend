const mongoose = require("mongoose");

const SubscribedSchema = mongoose.Schema({
 
  email: {
    type: String,
    required: true,
   
  },
 
});

const SubscribedModel = mongoose.model(
  "subscribeduser",
  SubscribedSchema
);

module.exports = { SubscribedModel };
