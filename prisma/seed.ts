import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.shrinkage.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartbiz.com',
      name: 'Admin User',
      passwordHash: '$2a$10$dummyhashforadmin',
      role: 'Admin',
    },
  });

  const cashier1 = await prisma.user.create({
    data: {
      email: 'cashier1@smartbiz.com',
      name: 'Jane Cashier',
      passwordHash: '$2a$10$dummyhashforcashier',
      role: 'Cashier',
    },
  });

  const cashier2 = await prisma.user.create({
    data: {
      email: 'cashier2@smartbiz.com',
      name: 'Bob Cashier',
      passwordHash: '$2a$10$dummyhashforcashier2',
      role: 'Cashier',
    },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: 'Coca-Cola 500ml',
        sku: 'BEV-001',
        barcode: '8901234567890',
        category: 'Beverages',
        currentStockLevel: 120,
        reorderThreshold: 30,
        defaultSalePrice: 1.50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Bread Loaf',
        sku: 'BAK-001',
        barcode: '8901234567891',
        category: 'Bakery',
        currentStockLevel: 25,
        reorderThreshold: 15,
        defaultSalePrice: 2.00,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Milk 1L',
        sku: 'DAI-001',
        barcode: '8901234567892',
        category: 'Dairy',
        currentStockLevel: 8,
        reorderThreshold: 20,
        defaultSalePrice: 1.80,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Rice 5kg',
        sku: 'GRA-001',
        barcode: '8901234567893',
        category: 'Grains',
        currentStockLevel: 45,
        reorderThreshold: 10,
        defaultSalePrice: 5.50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Cooking Oil 1L',
        sku: 'GRA-002',
        barcode: '8901234567894',
        category: 'Grains',
        currentStockLevel: 30,
        reorderThreshold: 10,
        defaultSalePrice: 3.20,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Sugar 1kg',
        sku: 'GRA-003',
        barcode: '8901234567895',
        category: 'Grains',
        currentStockLevel: 55,
        reorderThreshold: 15,
        defaultSalePrice: 1.20,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Soap Bar',
        sku: 'HOM-001',
        barcode: '8901234567896',
        category: 'Household',
        currentStockLevel: 60,
        reorderThreshold: 20,
        defaultSalePrice: 0.80,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Toothpaste',
        sku: 'HOM-002',
        barcode: '8901234567897',
        category: 'Household',
        currentStockLevel: 35,
        reorderThreshold: 10,
        defaultSalePrice: 2.50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Bottled Water 1.5L',
        sku: 'BEV-002',
        barcode: '8901234567898',
        category: 'Beverages',
        currentStockLevel: 200,
        reorderThreshold: 50,
        defaultSalePrice: 0.60,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Chips Pack',
        sku: 'SNK-001',
        barcode: '8901234567899',
        category: 'Snacks',
        currentStockLevel: 80,
        reorderThreshold: 25,
        defaultSalePrice: 1.00,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Chocolate Bar',
        sku: 'SNK-002',
        barcode: '8901234567900',
        category: 'Snacks',
        currentStockLevel: 3,
        reorderThreshold: 15,
        defaultSalePrice: 1.80,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Laundry Detergent',
        sku: 'HOM-003',
        barcode: '8901234567901',
        category: 'Household',
        currentStockLevel: 40,
        reorderThreshold: 10,
        defaultSalePrice: 4.50,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Canned Beans',
        sku: 'CAN-001',
        barcode: '8901234567902',
        category: 'Canned Goods',
        currentStockLevel: 90,
        reorderThreshold: 20,
        defaultSalePrice: 1.10,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Pasta 500g',
        sku: 'GRA-004',
        barcode: '8901234567903',
        category: 'Grains',
        currentStockLevel: 65,
        reorderThreshold: 15,
        defaultSalePrice: 1.30,
      },
    }),
    prisma.product.create({
      data: {
        name: 'Coffee 250g',
        sku: 'BEV-003',
        barcode: '8901234567904',
        category: 'Beverages',
        currentStockLevel: 18,
        reorderThreshold: 10,
        defaultSalePrice: 3.50,
      },
    }),
    // Dead stock product - high inventory, no sales
    prisma.product.create({
      data: {
        name: 'Seasonal Decor Pack',
        sku: 'MIS-001',
        barcode: '8901234567905',
        category: 'Miscellaneous',
        currentStockLevel: 100,
        reorderThreshold: 5,
        defaultSalePrice: 8.00,
      },
    }),
  ]);

  // Create inventory batches for each product
  const batchData = products.flatMap((product) => {
    const purchasePrice = product.defaultSalePrice * 0.6; // ~40% margin
    return [
      {
        productId: product.id,
        quantityAdded: Math.floor(product.currentStockLevel * 0.6),
        purchasePricePerUnit: purchasePrice,
        supplier: 'Global Supply Co.',
        dateReceived: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
      {
        productId: product.id,
        quantityAdded: Math.floor(product.currentStockLevel * 0.4),
        purchasePricePerUnit: purchasePrice * 0.95, // Slightly cheaper later batch
        supplier: 'Metro Distributors',
        dateReceived: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      },
    ];
  });

  await prisma.inventoryBatch.createMany({ data: batchData });

  // Create historical sales data (last 30 days)
  const now = new Date();
  const salesData = [];
  const saleItemsData: Array<{
    saleId: string;
    productId: string;
    quantitySold: number;
    salePricePerUnit: number;
    costPricePerUnit: number;
  }> = [];

  // Generate 50 sales over the last 30 days
  for (let day = 0; day < 30; day++) {
    const salesThisDay = Math.floor(Math.random() * 3) + 1; // 1-3 sales per day
    for (let s = 0; s < salesThisDay; s++) {
      const saleDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      saleDate.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));

      // Pick 1-4 random products for this sale
      const numItems = Math.floor(Math.random() * 4) + 1;
      const selectedProducts = [...products]
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);

      // Skip the dead stock product (MIS-001) for most sales
      const filteredProducts = selectedProducts.filter(
        (p) => p.sku !== 'MIS-001' || Math.random() < 0.05 // 5% chance of selling dead stock
      );

      if (filteredProducts.length === 0) continue;

      let totalAmount = 0;
      const items: Array<{
        productId: string;
        quantitySold: number;
        salePricePerUnit: number;
        costPricePerUnit: number;
      }> = [];

      for (const product of filteredProducts) {
        const quantitySold = Math.floor(Math.random() * 5) + 1;
        const salePrice = product.defaultSalePrice;
        const costPrice = product.defaultSalePrice * 0.6;
        totalAmount += salePrice * quantitySold;
        items.push({
          productId: product.id,
          quantitySold,
          salePricePerUnit: salePrice,
          costPricePerUnit: costPrice,
        });
      }

      const discount = Math.random() < 0.2 ? totalAmount * 0.1 : 0; // 20% chance of 10% discount

      const userId = Math.random() < 0.5 ? cashier1.id : cashier2.id;

      salesData.push({
        totalAmount: totalAmount - discount,
        discount,
        saleDate,
        userId,
      });

      // We'll create SaleItems after we have the sale IDs
      saleItemsData.push(...items.map(item => ({ ...item, _saleIndex: salesData.length - 1 })));
    }
  }

  // Create sales with items
  for (let i = 0; i < salesData.length; i++) {
    const sale = await prisma.sale.create({
      data: salesData[i],
    });

    const itemsForThisSale = saleItemsData.filter(
      (item: any) => item._saleIndex === i
    );

    for (const item of itemsForThisSale) {
      await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: item.productId,
          quantitySold: item.quantitySold,
          salePricePerUnit: item.salePricePerUnit,
          costPricePerUnit: item.costPricePerUnit,
        },
      });
    }
  }

  // Create some shrinkage records
  const shrinkageReasons = ['Stolen', 'Expired', 'Damaged'];
  const shrinkageProducts = products.filter(
    (p) => p.sku !== 'MIS-001'
  );

  for (let day = 0; day < 20; day++) {
    if (Math.random() < 0.4) { // 40% chance of shrinkage on any day
      const product = shrinkageProducts[Math.floor(Math.random() * shrinkageProducts.length)];
      const reason = shrinkageReasons[Math.floor(Math.random() * shrinkageReasons.length)];
      const quantityLost = Math.floor(Math.random() * 5) + 1;

      await prisma.shrinkage.create({
        data: {
          productId: product.id,
          quantityLost,
          reason,
          dateRecorded: new Date(now.getTime() - day * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  console.log('Seed data created successfully!');
  console.log(`Users: ${await prisma.user.count()}`);
  console.log(`Products: ${await prisma.product.count()}`);
  console.log(`Inventory Batches: ${await prisma.inventoryBatch.count()}`);
  console.log(`Sales: ${await prisma.sale.count()}`);
  console.log(`Sale Items: ${await prisma.saleItem.count()}`);
  console.log(`Shrinkage Records: ${await prisma.shrinkage.count()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
