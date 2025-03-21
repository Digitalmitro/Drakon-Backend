const Cart = require("../models/Cart");
const Product = require("../models/ClientModel/FeaturedProducts");

// Add to Cart
exports.addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, products: [], subtotal: 0, totalAmount: 0 });
    }

    const existingProduct = cart.products.find(p => p.productId.toString() === productId);
    if (existingProduct) {
      existingProduct.quantity += quantity;
      existingProduct.total = existingProduct.quantity * product.price;
    } else {
      cart.products.push({
        productId,
        quantity,
        price: product.price,
        total: product.price * quantity,
      });
    }

    cart.subtotal = cart.products.reduce((sum, p) => sum + p.total, 0);
    cart.totalAmount = cart.subtotal + cart.shippingCost - cart.discount;

    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Get Cart
exports.getCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const cart = await Cart.findOne({ userId }).populate("products.productId", "title price image");
    if (!cart) return res.status(404).json({ message: "Cart is empty" });
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update Cart Item Quantity
exports.updateCart = async (req, res) => {
  try {
    const { userId, productId, quantity } = req.body;
    const cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const item = cart.products.find(p => p.productId.toString() === productId);
    if (!item) return res.status(404).json({ message: "Product not in cart" });

    item.quantity = quantity;
    item.total = item.quantity * item.price;

    cart.subtotal = cart.products.reduce((sum, p) => sum + p.total, 0);
    cart.totalAmount = cart.subtotal + cart.shippingCost - cart.discount;

    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Remove Item from Cart
exports.removeFromCart = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    let cart = await Cart.findOne({ userId });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    cart.products = cart.products.filter(p => p.productId.toString() !== productId);

    cart.subtotal = cart.products.reduce((sum, p) => sum + p.total, 0);
    cart.totalAmount = cart.subtotal + cart.shippingCost - cart.discount;

    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Clear Cart
exports.clearCart = async (req, res) => {
  try {
    const { userId } = req.params;
    await Cart.findOneAndDelete({ userId });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
