require("dotenv").config();
const mongoose = require("mongoose");
const { FeaturedpoductModal } = require("./models/ClientModel/FeaturedProducts");

const updateProductSizing = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Update products with category "Equipment" and titles containing "Sliding mitt" or "elbow guard"
    const result = await FeaturedpoductModal.updateMany(
      {
        category: { $regex: /equipment/i },
        $or: [
          { title: { $regex: /Sliding Mitt/i } },
          { title: { $regex: /Elbow guard/i } }
        ],
        $or: [
          { size: { $exists: false } },
          { size: { $size: 0 } }
        ]
      },
      {
        $set: {
          size: ["Youth", "Adult"]
        }
      }
    );

    console.log(`Updated ${result.modifiedCount} products with Youth and Adult sizing`);

    // Display the updated products
    const updatedProducts = await FeaturedpoductModal.find({
      category: { $regex: /equipment/i },
      $or: [
        { title: { $regex: /Sliding Mitt/i } },
        { title: { $regex: /Elbow guard/i } }
      ]
    });

    console.log("\nUpdated products:");
    updatedProducts.forEach(product => {
      console.log(`- ${product.title} (${product.category}): ${product.size}`);
    });

    await mongoose.connection.close();
    console.log("\nDatabase connection closed");
  } catch (error) {
    console.error("Error updating products:", error);
    process.exit(1);
  }
};

updateProductSizing();
