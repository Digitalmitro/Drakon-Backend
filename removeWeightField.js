const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function removeWeightField() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Update featured-products collection
    const featuredResult = await db.collection('featured-products').updateMany(
      {},
      {
        $unset: { 
          weight: "",
          "size.$[].weight": ""
        }
      }
    );
    console.log(`Featured Products: Modified ${featuredResult.modifiedCount} documents`);

    // Update products collection
    const productsResult = await db.collection('products').updateMany(
      {},
      {
        $unset: { 
          weight: "",
          "size.$[].weight": ""
        }
      }
    );
    console.log(`Products: Modified ${productsResult.modifiedCount} documents`);

    console.log('\n✅ Migration completed successfully!');
    console.log('Weight fields have been removed from all products.');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

removeWeightField();
