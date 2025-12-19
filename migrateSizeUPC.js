require("dotenv").config();
const mongoose = require("mongoose");
const { FeaturedpoductModal } = require("./models/ClientModel/FeaturedProducts");

const migrateProducts = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get all products
    const products = await FeaturedpoductModal.find({});
    console.log(`📦 Found ${products.length} products to migrate`);

    let migratedCount = 0;

    for (const product of products) {
      // Check if size is already an array of objects
      if (product.size && Array.isArray(product.size) && product.size.length > 0) {
        // If first element is already an object, skip
        if (typeof product.size[0] === 'object' && product.size[0] !== null) {
          console.log(`⏭️  Skipping "${product.title}" - already migrated`);
          continue;
        }

        // Convert old size array to new format
        const newSizeArray = product.size.map(sizeValue => ({
          size: sizeValue,
          upc: null,
          weight: product.weight || 0
        }));

        // Update the product
        await FeaturedpoductModal.findByIdAndUpdate(product._id, {
          size: newSizeArray,
          hasNoSize: false
        });

        migratedCount++;
        console.log(`✅ Migrated "${product.title}" with ${newSizeArray.length} sizes`);
      }
    }

    console.log(`\n🎉 Migration complete! ${migratedCount} products migrated.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error);
    process.exit(1);
  }
};

migrateProducts();
