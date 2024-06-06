const mongoose = require("mongoose");

const accountdetailSchema = new mongoose.Schema({
    firstName: { type: String },
    lastName: { type: String },
    displayName: { type: String },
    password: {type: String},
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "register client",
        required: true,
    },
});

const AccountdetailModel = mongoose.model("accountdetail", accountdetailSchema);

module.exports = { AccountdetailModel };

