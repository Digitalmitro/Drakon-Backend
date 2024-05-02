const mongoose = require("mongoose");

const productsSchema = mongoose.Schema({
    image: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    year: {
        type: String,
    }, 
    cutting: {
        type: String,
    }, 
    grade: {
        type: String, 
    },
    region: {
        type: String, 
    },
    color: {
        type: String, 
    },
    leaf: {
        type: String, 
    },
    bleach: {
        type: String, 
    },
    texture: {
        type: String,
    },
    stemSize: {
        type: String, 
    },
});

const ProductsModal = mongoose.model("products", productsSchema);

module.exports = { ProductsModal };
