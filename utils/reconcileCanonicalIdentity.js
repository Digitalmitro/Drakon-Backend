require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const ProductIdentityMap = require("../models/ProductIdentityMap");
const SkuAliasMap = require("../models/SkuAliasMap");
const SyncAuditLog = require("../models/SyncAuditLog");
const { normalizeUpc, canonicalSkuFromUpc, safeString } = require("./canonicalIdentity");

let XLSX = null;
try {
  XLSX = require("xlsx");
} catch (error) {
  XLSX = null;
}

function getWorkbookPath() {
  const cliPath = process.argv.find((arg) => arg.startsWith("--file="));
  if (cliPath) return cliPath.replace("--file=", "");

  const candidates = [
    "/Users/soumikadas/Downloads/upc.xlsx",
    path.resolve(process.cwd(), "upc.xlsx"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return "";
}

function getValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }
  return "";
}

async function run() {
  const applyChanges = process.argv.includes("--apply");

  if (!XLSX) {
    console.error("❌ Missing dependency 'xlsx'. Install it before running this script.");
    process.exit(1);
  }

  const workbookPath = getWorkbookPath();
  if (!workbookPath || !fs.existsSync(workbookPath)) {
    console.error("❌ Could not locate upc.xlsx. Provide --file=/absolute/path/to/upc.xlsx");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const workbook = XLSX.readFile(workbookPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let rowsScanned = 0;
    let rowsValid = 0;
    let identitiesCreated = 0;
    let identitiesUpdated = 0;
    let aliasesUpserted = 0;
    let rejected = 0;

    const rejectedRows = [];

    for (const row of rows) {
      rowsScanned += 1;

      const rawUpc = getValue(row, ["upc", "UPC", "canonical_upc", "canonicalUPC", "UPC Barcode", "upc barcode"]);
      const rawName = getValue(row, ["name", "Name", "title", "product_name", "canonical_name", "Product info", "product info"]);
      const rawAliasSku = getValue(row, ["alias_sku", "aliasSku", "sku", "SKU"]);
      const rawProductInfoSku = getValue(row, ["Product info", "product info", "productInfo"]);

      const upcNormalized = normalizeUpc(rawUpc);
      if (!upcNormalized) {
        rejected += 1;
        if (rejectedRows.length < 30) {
          rejectedRows.push({ reason: "INVALID_UPC", rawUpc, rawName, rawAliasSku });
        }
        continue;
      }

      rowsValid += 1;
      const canonicalSku = canonicalSkuFromUpc(upcNormalized);
      const canonicalName = safeString(rawName) || `UPC ${upcNormalized}`;

      if (applyChanges) {
        const before = await ProductIdentityMap.findOne({ upcNormalized }).lean();

        await ProductIdentityMap.updateOne(
          { upcNormalized },
          {
            $set: {
              canonicalSku,
              canonicalName,
              isActive: true,
              source: "manual",
              "metadata.xlsxProductInfo": safeString(rawProductInfoSku),
              "metadata.preferredShipstationSku": safeString(rawProductInfoSku),
            },
            $setOnInsert: {
              sourceProductId: "",
            },
          },
          { upsert: true }
        );

        if (before) identitiesUpdated += 1;
        else identitiesCreated += 1;

        const aliasSku = safeString(rawAliasSku);
        if (aliasSku && aliasSku !== canonicalSku) {
          await SkuAliasMap.updateOne(
            { aliasSku, upcNormalized },
            {
              $setOnInsert: {
                aliasSku,
                upcNormalized,
                source: "manual",
                notes: "Imported from UPC workbook",
              },
            },
            { upsert: true }
          );
          aliasesUpserted += 1;
        }

        const productInfoAlias = safeString(rawProductInfoSku);
        if (productInfoAlias && productInfoAlias !== canonicalSku && productInfoAlias !== aliasSku) {
          await SkuAliasMap.updateOne(
            { aliasSku: productInfoAlias, upcNormalized },
            {
              $setOnInsert: {
                aliasSku: productInfoAlias,
                upcNormalized,
                source: "manual",
                notes: "Imported from XLSX Product info",
              },
            },
            { upsert: true }
          );
          aliasesUpserted += 1;
        }
      }
    }

    const summary = {
      mode: applyChanges ? "APPLY" : "DRY_RUN",
      workbookPath,
      rowsScanned,
      rowsValid,
      rejected,
      identitiesCreated,
      identitiesUpdated,
      aliasesUpserted,
      rejectedRows,
    };

    if (applyChanges) {
      await SyncAuditLog.create({
        entityType: "product_identity_map",
        entityKey: "reconcile_from_workbook",
        action: "bulk_reconcile",
        status: "success",
        details: summary,
      });
    }

    console.log("\n========== CANONICAL IDENTITY RECONCILIATION ==========");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("❌ Reconciliation failed", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
