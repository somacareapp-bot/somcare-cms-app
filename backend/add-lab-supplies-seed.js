#!/usr/bin/env node
/**
 * Bulk-inserts the 100-item lab supply catalog directly into Postgres.
 *
 * Run from the backend folder so `require('pg')` resolves against its
 * node_modules:
 *
 *   cd "/Users/adminnopassword/Documents/Clinical MS/cms/backend"
 *   node add-lab-supplies-seed.js
 *
 * Reads DB connection info from backend/.env (falls back to the same
 * defaults app.module.ts uses: localhost / 5432).
 *
 * Safe to re-run: existing supplies are matched by name and skipped
 * (ON CONFLICT (name) DO NOTHING) rather than duplicated.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

function loadEnv(envPath) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const env = loadEnv(path.join(__dirname, '.env'));
const get = (key, fallback) => process.env[key] || env[key] || fallback;

const client = new Client({
  host: get('DB_HOST', 'localhost'),
  port: Number(get('DB_PORT', 5432)),
  user: get('DB_USERNAME'),
  password: get('DB_PASSWORD'),
  database: get('DB_NAME'),
});

// name, category, unit, stockQty, reorderLevel, costPrice, sellPrice, batchNumber, expiryDate
const ROWS = [
  ['Blood Collection Tube – EDTA', 'blood_collection', 'Box', 25, 10, 4.50, 7.00, 'BCT-2601', '2028-01-31'],
  ['Blood Collection Tube – Plain', 'blood_collection', 'Box', 20, 8, 4.00, 6.50, 'BCT-2602', '2028-02-28'],
  ['Blood Collection Tube – Citrate', 'blood_collection', 'Box', 18, 8, 5.00, 8.00, 'BCT-2603', '2028-03-31'],
  ['Blood Collection Tube – Heparin', 'blood_collection', 'Box', 15, 6, 5.50, 8.50, 'BCT-2604', '2028-04-30'],
  ['ESR Tube', 'blood_collection', 'Box', 12, 5, 6.00, 9.00, 'ESR-2601', '2028-05-31'],
  ['Micro Blood Collection Tube', 'blood_collection', 'Box', 10, 4, 7.00, 10.00, 'MCT-2601', '2028-06-30'],
  ['Lancets', 'blood_collection', 'Box', 30, 10, 3.00, 5.00, 'LAN-2601', '2029-01-31'],
  ['Blood Transfer Pipette', 'blood_collection', 'Pack', 20, 8, 2.50, 4.00, 'BTP-2601', '2029-02-28'],
  ['Capillary Tubes', 'blood_collection', 'Box', 15, 5, 3.50, 5.50, 'CPT-2601', '2028-08-31'],
  ['Tourniquet', 'blood_collection', 'Piece', 25, 8, 1.50, 3.00, 'TRQ-2601', '2030-01-31'],
  ['Disposable Syringe 2ml', 'consumable', 'Box', 20, 8, 6.00, 9.00, 'SYR-2601', '2029-01-31'],
  ['Disposable Syringe 5ml', 'consumable', 'Box', 25, 10, 7.00, 10.00, 'SYR-2602', '2029-02-28'],
  ['Disposable Syringe 10ml', 'consumable', 'Box', 18, 7, 9.00, 13.00, 'SYR-2603', '2029-03-31'],
  ['Disposable Syringe 20ml', 'consumable', 'Box', 12, 5, 12.00, 17.00, 'SYR-2604', '2029-04-30'],
  ['Needles 21G', 'consumable', 'Box', 20, 8, 5.00, 8.00, 'NDL-2601', '2029-05-31'],
  ['Needles 23G', 'consumable', 'Box', 20, 8, 5.00, 8.00, 'NDL-2602', '2029-05-31'],
  ['Needles 25G', 'consumable', 'Box', 15, 6, 5.50, 8.50, 'NDL-2603', '2029-06-30'],
  ['Alcohol Swabs', 'consumable', 'Box', 35, 12, 3.00, 5.00, 'ASW-2601', '2028-07-31'],
  ['Cotton Wool', 'consumable', 'Roll', 30, 10, 2.50, 4.00, 'CTW-2601', '2029-08-31'],
  ['Gauze Swabs', 'consumable', 'Pack', 40, 15, 2.00, 3.50, 'GSW-2601', '2029-09-30'],
  ['Examination Gloves – S', 'ppe', 'Box', 40, 15, 4.00, 6.50, 'GLV-2601', '2029-01-31'],
  ['Examination Gloves – M', 'ppe', 'Box', 50, 20, 4.00, 6.50, 'GLV-2602', '2029-02-28'],
  ['Examination Gloves – L', 'ppe', 'Box', 45, 18, 4.00, 6.50, 'GLV-2603', '2029-03-31'],
  ['Surgical Masks', 'ppe', 'Box', 35, 12, 3.50, 5.50, 'MSK-2601', '2029-04-30'],
  ['Face Shield', 'ppe', 'Piece', 20, 8, 2.50, 4.50, 'FSH-2601', '2030-01-31'],
  ['Laboratory Coat', 'ppe', 'Piece', 15, 5, 12.00, 18.00, 'LCT-2601', '2030-12-31'],
  ['N95 Respirator', 'ppe', 'Box', 15, 5, 8.00, 12.00, 'N95-2601', '2029-05-31'],
  ['Shoe Covers', 'ppe', 'Pack', 20, 8, 3.00, 5.00, 'SCV-2601', '2029-06-30'],
  ['Hair Covers', 'ppe', 'Pack', 25, 10, 2.00, 3.50, 'HCV-2601', '2029-07-31'],
  ['Protective Apron', 'ppe', 'Piece', 15, 5, 5.00, 8.00, 'APR-2601', '2030-01-31'],
  ['Urine Sample Container', 'specimen_containers', 'Pack', 30, 10, 3.50, 5.50, 'USC-2601', '2029-01-31'],
  ['Stool Sample Container', 'specimen_containers', 'Pack', 25, 8, 3.00, 5.00, 'SSC-2601', '2029-02-28'],
  ['Sputum Container', 'specimen_containers', 'Pack', 20, 8, 4.00, 6.00, 'SPC-2601', '2029-03-31'],
  ['Sterile Sample Cup', 'specimen_containers', 'Pack', 25, 10, 3.50, 5.50, 'SSC-2602', '2029-04-30'],
  ['Universal Specimen Container', 'specimen_containers', 'Pack', 30, 10, 4.00, 6.00, 'USC-2602', '2029-05-31'],
  ['Transport Swab', 'specimen_collection', 'Pack', 20, 8, 5.00, 8.00, 'SWB-2601', '2028-06-30'],
  ['Sterile Swab', 'specimen_collection', 'Pack', 30, 10, 3.00, 5.00, 'SWB-2602', '2029-07-31'],
  ['Wooden Applicator Sticks', 'specimen_collection', 'Pack', 20, 8, 2.00, 3.50, 'WAS-2601', '2029-08-31'],
  ['Microscope Slides', 'microscopy', 'Box', 25, 10, 4.00, 6.50, 'MSL-2601', '2030-01-31'],
  ['Cover Slips', 'microscopy', 'Box', 20, 8, 3.00, 5.00, 'CSV-2601', '2030-02-28'],
  ['Immersion Oil', 'microscopy', 'Bottle', 15, 5, 5.00, 8.00, 'IMO-2601', '2029-03-31'],
  ['Lens Cleaning Tissue', 'microscopy', 'Pack', 15, 5, 2.50, 4.00, 'LCT-2602', '2030-04-30'],
  ['Pasteur Pipette', 'laboratory_supplies', 'Pack', 25, 10, 3.00, 5.00, 'PIP-2601', '2029-05-31'],
  ['Transfer Pipette', 'laboratory_supplies', 'Pack', 30, 10, 3.00, 5.00, 'PIP-2602', '2029-06-30'],
  ['Micropipette Tips 10µL', 'laboratory_supplies', 'Box', 15, 5, 6.00, 9.00, 'MPT-2601', '2030-07-31'],
  ['Micropipette Tips 200µL', 'laboratory_supplies', 'Box', 20, 8, 7.00, 10.00, 'MPT-2602', '2030-08-31'],
  ['Micropipette Tips 1000µL', 'laboratory_supplies', 'Box', 15, 5, 8.00, 12.00, 'MPT-2603', '2030-09-30'],
  ['Test Tube', 'laboratory_supplies', 'Box', 20, 8, 5.00, 8.00, 'TTB-2601', '2030-01-31'],
  ['Test Tube Rack', 'laboratory_supplies', 'Piece', 12, 4, 6.00, 10.00, 'TTR-2601', '2032-01-31'],
  ['Centrifuge Tube 15ml', 'laboratory_supplies', 'Pack', 20, 8, 6.00, 9.00, 'CFT-2601', '2030-02-28'],
  ['Normal Saline', 'reagent', 'Bottle', 20, 8, 3.00, 5.00, 'NS-2601', '2028-01-31'],
  ['Distilled Water', 'reagent', 'Bottle', 30, 10, 2.00, 3.50, 'DW-2601', '2028-02-28'],
  ['Methanol', 'reagent', 'Bottle', 15, 5, 5.00, 8.00, 'MET-2601', '2028-03-31'],
  ['Ethanol 70%', 'reagent', 'Bottle', 20, 8, 4.00, 6.50, 'ETH-2601', '2028-04-30'],
  ['Iodine Solution', 'reagent', 'Bottle', 15, 5, 3.50, 6.00, 'IOD-2601', '2028-05-31'],
  ['Gram Stain Crystal Violet', 'reagent', 'Bottle', 10, 4, 7.00, 11.00, 'GCV-2601', '2028-06-30'],
  ['Gram Stain Safranin', 'reagent', 'Bottle', 10, 4, 6.00, 10.00, 'GSA-2601', '2028-07-31'],
  ['Gram Stain Iodine', 'reagent', 'Bottle', 10, 4, 6.00, 10.00, 'GIO-2601', '2028-08-31'],
  ['Gram Decolorizer', 'reagent', 'Bottle', 10, 4, 5.00, 8.00, 'GDE-2601', '2028-09-30'],
  ['Giemsa Stain', 'reagent', 'Bottle', 12, 5, 8.00, 12.00, 'GIE-2601', '2028-10-31'],
  ['Malaria Test Kit', 'rapid_test_kits', 'Box', 15, 5, 18.00, 25.00, 'MAL-2601', '2027-11-30'],
  ['Pregnancy Test Kit', 'rapid_test_kits', 'Box', 20, 8, 12.00, 18.00, 'PRG-2601', '2028-01-31'],
  ['HIV Rapid Test Kit', 'rapid_test_kits', 'Box', 10, 4, 25.00, 35.00, 'HIV-2601', '2027-12-31'],
  ['Hepatitis B Test Kit', 'rapid_test_kits', 'Box', 12, 5, 20.00, 30.00, 'HEP-2601', '2028-02-28'],
  ['Hepatitis C Test Kit', 'rapid_test_kits', 'Box', 10, 4, 22.00, 32.00, 'HCV-2601', '2028-03-31'],
  ['Syphilis Test Kit', 'rapid_test_kits', 'Box', 12, 5, 18.00, 27.00, 'SYP-2601', '2028-04-30'],
  ['Dengue Test Kit', 'rapid_test_kits', 'Box', 8, 3, 25.00, 35.00, 'DEN-2601', '2028-05-31'],
  ['Typhoid Test Kit', 'rapid_test_kits', 'Box', 10, 4, 15.00, 22.00, 'TYP-2601', '2028-06-30'],
  ['H. pylori Test Kit', 'rapid_test_kits', 'Box', 10, 4, 20.00, 30.00, 'HPL-2601', '2028-07-31'],
  ['Rheumatoid Factor Test Kit', 'rapid_test_kits', 'Box', 8, 3, 22.00, 32.00, 'RF-2601', '2028-08-31'],
  ['Glucose Test Strips', 'biochemistry', 'Box', 20, 8, 10.00, 15.00, 'GLU-2601', '2028-01-31'],
  ['Glucose Control Solution', 'biochemistry', 'Bottle', 8, 3, 8.00, 12.00, 'GCS-2601', '2027-12-31'],
  ['Urinalysis Test Strips', 'biochemistry', 'Bottle', 15, 5, 12.00, 18.00, 'UTS-2601', '2028-02-28'],
  ['Protein Test Reagent', 'biochemistry', 'Bottle', 10, 4, 9.00, 14.00, 'PTR-2601', '2028-03-31'],
  ['Bilirubin Reagent', 'biochemistry', 'Kit', 8, 3, 15.00, 22.00, 'BIL-2601', '2028-04-30'],
  ['Creatinine Reagent', 'biochemistry', 'Kit', 8, 3, 18.00, 26.00, 'CRE-2601', '2028-05-31'],
  ['Urea Reagent', 'biochemistry', 'Kit', 8, 3, 17.00, 25.00, 'URE-2601', '2028-06-30'],
  ['Cholesterol Reagent', 'biochemistry', 'Kit', 8, 3, 18.00, 27.00, 'CHO-2601', '2028-07-31'],
  ['Triglyceride Reagent', 'biochemistry', 'Kit', 8, 3, 18.00, 27.00, 'TRI-2601', '2028-08-31'],
  ['ALT Reagent', 'biochemistry', 'Kit', 8, 3, 20.00, 30.00, 'ALT-2601', '2028-09-30'],
  ['AST Reagent', 'biochemistry', 'Kit', 8, 3, 20.00, 30.00, 'AST-2601', '2028-10-31'],
  ['Alkaline Phosphatase Reagent', 'biochemistry', 'Kit', 6, 3, 22.00, 33.00, 'ALP-2601', '2028-11-30'],
  ['Calcium Reagent', 'biochemistry', 'Kit', 8, 3, 16.00, 24.00, 'CAL-2601', '2028-12-31'],
  ['Uric Acid Reagent', 'biochemistry', 'Kit', 7, 3, 18.00, 27.00, 'URA-2601', '2029-01-31'],
  ['Hemoglobin Reagent', 'hematology', 'Kit', 10, 4, 15.00, 22.00, 'HGB-2601', '2028-02-28'],
  ['ESR Reagent', 'hematology', 'Kit', 8, 3, 12.00, 18.00, 'ESR-2602', '2028-03-31'],
  ['Hematology Control', 'hematology', 'Vial', 6, 2, 25.00, 35.00, 'HCT-2601', '2027-12-31'],
  ['Blood Grouping Anti-A', 'blood_banking', 'Bottle', 8, 3, 10.00, 15.00, 'ANTA-2601', '2028-04-30'],
  ['Blood Grouping Anti-B', 'blood_banking', 'Bottle', 8, 3, 10.00, 15.00, 'ANTB-2601', '2028-04-30'],
  ['Blood Grouping Anti-D', 'blood_banking', 'Bottle', 8, 3, 12.00, 18.00, 'ANTD-2601', '2028-05-31'],
  ['Blood Grouping Slides', 'blood_banking', 'Box', 15, 5, 4.00, 6.50, 'BGS-2601', '2030-06-30'],
  ['Coombs Reagent', 'blood_banking', 'Bottle', 6, 2, 18.00, 27.00, 'CMB-2601', '2028-07-31'],
  ['QC Control Serum', 'quality_control', 'Vial', 8, 3, 20.00, 30.00, 'QCS-2601', '2027-12-31'],
  ['Laboratory Disinfectant', 'cleaning_supplies', 'Bottle', 20, 8, 5.00, 8.00, 'LDS-2601', '2029-01-31'],
  ['Biohazard Waste Bags', 'waste_management', 'Pack', 25, 10, 4.00, 6.50, 'BWB-2601', '2029-02-28'],
  ['Sharps Disposal Container', 'waste_management', 'Piece', 15, 5, 3.50, 6.00, 'SDC-2601', '2030-03-31'],
  ['Laboratory Detergent', 'cleaning_supplies', 'Bottle', 15, 5, 4.00, 6.50, 'LDT-2601', '2029-04-30'],
  ['Disposable Sample Cups', 'specimen_containers', 'Pack', 25, 10, 3.00, 5.00, 'DSC-2601', '2029-05-31'],
  ['Cryovial Tubes', 'specimen_containers', 'Box', 10, 4, 8.00, 12.00, 'CRV-2601', '2030-06-30'],
  ['Laboratory Label Stickers', 'laboratory_supplies', 'Roll', 20, 8, 2.50, 4.00, 'LBL-2601', '2030-07-31'],
];

async function main() {
  await client.connect();

  const insertSql = `
    INSERT INTO lab_supplies
      (id, name, category, unit, stock_quantity, reorder_level, cost_price, sell_price,
       batch_number, expiry_date, is_active, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, now(), now())
    ON CONFLICT (name) DO NOTHING
  `;

  let inserted = 0;
  let skipped = 0;

  for (const [name, category, unit, stockQty, reorderLevel, costPrice, sellPrice, batchNumber, expiryDate] of ROWS) {
    const id = crypto.randomUUID();
    const res = await client.query(insertSql, [
      id, name, category, unit, stockQty, reorderLevel, costPrice, sellPrice, batchNumber, expiryDate,
    ]);
    if (res.rowCount > 0) inserted++;
    else skipped++;
  }

  console.log(`Inserted: ${inserted}`);
  console.log(`Skipped (already existed by name): ${skipped}`);

  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  if (err.message && err.message.includes('invalid input value for enum')) {
    console.error(
      '\nThe Postgres enum type for lab_supplies.category is missing one of these values.\n' +
      'Run widen-lab-supply-categories.py and restart the backend (so TypeORM synchronize\n' +
      'widens the enum) before re-running this seed script.',
    );
  }
  process.exit(1);
});
