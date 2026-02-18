const Cart = require("../models/Cart");
const { FeaturedpoductModal } = require("../models/ClientModel/FeaturedProducts");

// Add to Cart
exports.addToCart = async (req, res) => {
  try {
    const { userId, productId, quantity, size } = req.body;

    const product = await FeaturedpoductModal.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const selectedSize = size || "One Size";
    const sizeData = selectedSize && product.size && Array.isArray(product.size)
      ? product.size.find((entry) => entry?.size === selectedSize)
      : null;

    const upc = sizeData?.upc || product.upc || "";
    const sku = sizeData?.sku || product.sku || `${product.title}${selectedSize && selectedSize !== "One Size" ? ` ${selectedSize}` : ""}`.trim();
    const weight = Number.isFinite(Number(sizeData?.weight))
      ? Number(sizeData.weight)
      : (Number.isFinite(Number(product.weight)) ? Number(product.weight) : 0);
    const weightUnits = sizeData?.weightUnits || product.weightUnits || "Pounds";

    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, products: [], subtotal: 0, totalAmount: 0 });
    }

    const existingProduct = cart.products.find(p => 
      p.productId.toString() === productId && p.size === selectedSize
    );
    
    if (existingProduct) {
      existingProduct.quantity += quantity;
      existingProduct.total = existingProduct.quantity * product.price;
    } else {
      cart.products.push({
        productId,
        quantity,
        price: product.price,
        total: product.price * quantity,
        size: selectedSize,
        upc,
        sku,
        weight,
        weightUnits,
      });
    }

    cart.subtotal = cart.products.reduce((sum, p) => sum + p.total, 0);
    cart.totalAmount = cart.subtotal + cart.shippingCost - cart.discount;

    await cart.save();
    res.status(200).json(cart);
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get Cart
exports.getCart = async (req, res) => {
  try {
    const userId = req.rootUser._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      select: "title price image stock size upc sku weight weightUnits"
    });
    
    if (!cart) return res.status(404).json({ message: "Cart is empty" });
    
    console.log('Cart products with UPC:', cart.products.map(p => ({
      size: p.size,
      upc: p.upc,
      productId: p.productId?._id
    }))); // Debug log
    
    res.status(200).json(cart);
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ error: "Server error" });
  }
};

// Update Cart Item Quantity
exports.updateCart = async (req, res) => {
  try {
    const userId = req.rootUser._id;
    const { productId, quantity } = req.body;
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
    const { productId } = req.body;
    const userId = req.rootUser._id;
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
    const userId = req.rootUser._id;
    await Cart.findOneAndDelete({ userId });
    res.status(200).json({ message: "Cart cleared" });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};
