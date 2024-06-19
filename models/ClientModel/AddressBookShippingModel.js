const mongoose = require("mongoose");

const addressbookshippingSchema = new mongoose.Schema({
    shippingfirstName: { type: String },
    shippinglastName: { type: String },
    shippingcountry: { type: String, required: true },
    shippingstreetAddress: { type: String },
    shippingcity: { type: String },
    shippingstate: { type: String },
    shippingzipcode: { type: Number, required: true },
    shippingphone: { type: Number, required: true },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "register client",
        required: true,
    },
});

const AddressBookShippingModel = mongoose.model("addressbookShipping", addressbookshippingSchema);

module.exports = { AddressBookShippingModel };
