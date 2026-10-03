import { ExcelField } from './excelTools';

// key = the property name your API already uses. aliases = other names an Excel file might use.

export const medicineExcelFields: ExcelField[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['medicine', 'medicine name', 'drug', 'drug name', 'item', 'product'] },
  { key: 'genericName', label: 'Generic Name', aliases: ['generic', 'active ingredient', 'composition'] },
  {
    key: 'category', label: 'Category', type: 'enum', defaultValue: 'other',
    options: ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'other'],
    aliases: ['type', 'form', 'dosage form', 'group'],
  },
  { key: 'stockQuantity', label: 'Stock', type: 'stock', unitKey: 'unit', defaultValue: 0, aliases: ['quantity', 'qty', 'on hand', 'balance', 'available', 'stock quantity'] },
  { key: 'unit', label: 'Unit', defaultValue: 'unit', aliases: ['uom', 'unit of measure', 'pack'] },
  { key: 'reorderLevel', label: 'Reorder Level', type: 'number', defaultValue: 10, aliases: ['min stock', 'minimum', 'reorder point', 'low stock level'] },
  { key: 'costPrice', label: 'Cost Price', type: 'number', defaultValue: 0, aliases: ['cost', 'purchase price', 'buying price', 'unit cost'] },
  { key: 'sellPrice', label: 'Sell Price', type: 'number', defaultValue: 0, aliases: ['selling price', 'price', 'retail price', 'sale price', 'unit price'] },
  { key: 'batchNumber', label: 'Batch Number', aliases: ['batch', 'batch no', 'lot', 'lot number'] },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date', aliases: ['expiry', 'exp', 'exp date', 'expiration', 'expire date'] },
];

export const labSupplyExcelFields: ExcelField[] = [
  { key: 'name', label: 'Name', required: true, aliases: ['supply', 'supply name', 'item', 'reagent', 'product'] },
  {
    key: 'category', label: 'Category', type: 'enum', defaultValue: 'other',
    options: [
      'reagent', 'consumable', 'equipment', 'ppe', 'other',
      'blood_collection', 'specimen_containers', 'specimen_collection', 'microscopy',
      'laboratory_supplies', 'rapid_test_kits', 'biochemistry', 'hematology',
      'blood_banking', 'quality_control', 'cleaning_supplies', 'waste_management',
    ],
    aliases: ['type', 'group'],
  },
  { key: 'stockQuantity', label: 'Stock', type: 'stock', unitKey: 'unit', defaultValue: 0, aliases: ['quantity', 'qty', 'on hand', 'balance', 'available', 'stock quantity'] },
  { key: 'unit', label: 'Unit', defaultValue: 'unit', aliases: ['uom', 'unit of measure', 'pack'] },
  { key: 'reorderLevel', label: 'Reorder Level', type: 'number', defaultValue: 10, aliases: ['min stock', 'minimum', 'reorder point', 'low stock level'] },
  { key: 'costPrice', label: 'Cost Price', type: 'number', defaultValue: 0, aliases: ['cost', 'purchase price', 'buying price', 'unit cost'] },
  { key: 'sellPrice', label: 'Sell Price', type: 'number', defaultValue: 0, aliases: ['selling price', 'price', 'retail price', 'sale price', 'unit price'] },
  { key: 'batchNumber', label: 'Batch Number', aliases: ['batch', 'batch no', 'lot', 'lot number'] },
  { key: 'expiryDate', label: 'Expiry Date', type: 'date', aliases: ['expiry', 'exp', 'exp date', 'expiration', 'expire date'] },
];
