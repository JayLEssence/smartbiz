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
  await prisma.branch.deleteMany();
  await prisma.company.deleteMany();

  // ==========================================
  // Company 1: SmartBiz Demo Corp
  // ==========================================
  const company1 = await prisma.company.create({
    data: {
      name: 'SmartBiz Demo Corp',
      industry: 'Retail',
      email: 'info@smartbiz.com',
      phone: '+255 100 200 300',
      address: '100 Business Avenue, Commercial District',
      plan: 'pro',
      isActive: true,
    },
  });

  console.log('Created Company 1: SmartBiz Demo Corp');

  // Create Branches for Company 1
  const mainBranch = await prisma.branch.create({
    data: {
      name: 'Main Branch - Downtown',
      code: 'MAIN',
      address: '123 Commerce Street, Downtown',
      phone: '+255 123 456 789',
      isHeadOffice: true,
      isActive: true,
      companyId: company1.id,
    },
  });

  const branchEast = await prisma.branch.create({
    data: {
      name: 'Eastside Branch',
      code: 'EAST',
      address: '456 Market Avenue, Eastside',
      phone: '+255 234 567 890',
      isHeadOffice: false,
      isActive: true,
      companyId: company1.id,
    },
  });

  const branchWest = await prisma.branch.create({
    data: {
      name: 'Westend Branch',
      code: 'WEST',
      address: '789 Trade Boulevard, Westend',
      phone: '+255 345 678 901',
      isHeadOffice: false,
      isActive: true,
      companyId: company1.id,
    },
  });

  console.log('Created 3 branches for Company 1');

  // Create Users for Company 1
  const admin = await prisma.user.create({
    data: {
      email: 'admin@smartbiz.com',
      name: 'Admin User',
      passwordHash: '$2a$10$dummyhashforadmin',
      role: 'CompanyAdmin',
      branchId: mainBranch.id,
      companyId: company1.id,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@smartbiz.com',
      name: 'Sarah Manager',
      passwordHash: '$2a$10$dummyhashformanager',
      role: 'Manager',
      branchId: mainBranch.id,
      companyId: company1.id,
    },
  });

  const cashier1 = await prisma.user.create({
    data: {
      email: 'cashier1@smartbiz.com',
      name: 'Jane Cashier',
      passwordHash: '$2a$10$dummyhashforcashier',
      role: 'Employee',
      branchId: mainBranch.id,
      companyId: company1.id,
    },
  });

  const cashier2 = await prisma.user.create({
    data: {
      email: 'cashier2@smartbiz.com',
      name: 'Bob Cashier',
      passwordHash: '$2a$10$dummyhashforcashier2',
      role: 'Employee',
      branchId: mainBranch.id,
      companyId: company1.id,
    },
  });

  const eastCashier = await prisma.user.create({
    data: {
      email: 'east@smartbiz.com',
      name: 'Alice East',
      passwordHash: '$2a$10$dummyhashforeast',
      role: 'Employee',
      branchId: branchEast.id,
      companyId: company1.id,
    },
  });

  const westCashier = await prisma.user.create({
    data: {
      email: 'west@smartbiz.com',
      name: 'Charlie West',
      passwordHash: '$2a$10$dummyhashforwest',
      role: 'Employee',
      branchId: branchWest.id,
      companyId: company1.id,
    },
  });

  console.log('Created 6 users for Company 1');

  // Create Products for Company 1
  const productDefinitions = [
    { name: 'Coca-Cola 500ml', sku: 'BEV-001', barcode: '8901234567890', category: 'Beverages', stock: 120, reorder: 30, price: 1.50 },
    { name: 'Bread Loaf', sku: 'BAK-001', barcode: '8901234567891', category: 'Bakery', stock: 25, reorder: 15, price: 2.00 },
    { name: 'Milk 1L', sku: 'DAI-001', barcode: '8901234567892', category: 'Dairy', stock: 8, reorder: 20, price: 1.80 },
    { name: 'Rice 5kg', sku: 'GRA-001', barcode: '8901234567893', category: 'Grains', stock: 45, reorder: 10, price: 5.50 },
    { name: 'Cooking Oil 1L', sku: 'GRA-002', barcode: '8901234567894', category: 'Grains', stock: 30, reorder: 10, price: 3.20 },
    { name: 'Sugar 1kg', sku: 'GRA-003', barcode: '8901234567895', category: 'Grains', stock: 55, reorder: 15, price: 1.20 },
    { name: 'Soap Bar', sku: 'HOM-001', barcode: '8901234567896', category: 'Household', stock: 60, reorder: 20, price: 0.80 },
    { name: 'Toothpaste', sku: 'HOM-002', barcode: '8901234567897', category: 'Household', stock: 35, reorder: 10, price: 2.50 },
    { name: 'Bottled Water 1.5L', sku: 'BEV-002', barcode: '8901234567898', category: 'Beverages', stock: 200, reorder: 50, price: 0.60 },
    { name: 'Chips Pack', sku: 'SNK-001', barcode: '8901234567899', category: 'Snacks', stock: 80, reorder: 25, price: 1.00 },
    { name: 'Chocolate Bar', sku: 'SNK-002', barcode: '8901234567900', category: 'Snacks', stock: 3, reorder: 15, price: 1.80 },
    { name: 'Laundry Detergent', sku: 'HOM-003', barcode: '8901234567901', category: 'Household', stock: 40, reorder: 10, price: 4.50 },
    { name: 'Canned Beans', sku: 'CAN-001', barcode: '8901234567902', category: 'Canned Goods', stock: 90, reorder: 20, price: 1.10 },
    { name: 'Pasta 500g', sku: 'GRA-004', barcode: '8901234567903', category: 'Grains', stock: 65, reorder: 15, price: 1.30 },
    { name: 'Coffee 250g', sku: 'BEV-003', barcode: '8901234567904', category: 'Beverages', stock: 18, reorder: 10, price: 3.50 },
    // Dead stock product - high inventory, no sales
    { name: 'Seasonal Decor Pack', sku: 'MIS-001', barcode: '8901234567905', category: 'Miscellaneous', stock: 100, reorder: 5, price: 8.00 },
  ];

  // Create products for main branch
  const mainProducts = await Promise.all(
    productDefinitions.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          currentStockLevel: p.stock,
          reorderThreshold: p.reorder,
          defaultSalePrice: p.price,
          branchId: mainBranch.id,
          companyId: company1.id,
          isActive: true,
        },
      })
    )
  );

  // Create products for East branch (slightly different stock levels)
  const eastProducts = await Promise.all(
    productDefinitions.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          currentStockLevel: Math.floor(p.stock * 0.7),
          reorderThreshold: p.reorder,
          defaultSalePrice: p.price,
          branchId: branchEast.id,
          companyId: company1.id,
          isActive: true,
        },
      })
    )
  );

  // Create products for West branch (slightly different stock levels)
  const westProducts = await Promise.all(
    productDefinitions.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          currentStockLevel: Math.floor(p.stock * 0.5),
          reorderThreshold: p.reorder,
          defaultSalePrice: p.price,
          branchId: branchWest.id,
          companyId: company1.id,
          isActive: true,
        },
      })
    )
  );

  console.log(`Created ${mainProducts.length * 3} products across 3 branches for Company 1`);

  // Create Inventory Batches for Company 1
  const allBranchProducts = [
    { branch: mainBranch, products: mainProducts },
    { branch: branchEast, products: eastProducts },
    { branch: branchWest, products: westProducts },
  ];

  for (const { branch, products } of allBranchProducts) {
    const batchData = products.flatMap((product) => {
      const purchasePrice = product.defaultSalePrice * 0.6;
      return [
        {
          productId: product.id,
          quantityAdded: Math.floor(product.currentStockLevel * 0.6),
          purchasePricePerUnit: purchasePrice,
          supplier: 'Global Supply Co.',
          dateReceived: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          branchId: branch.id,
        },
        {
          productId: product.id,
          quantityAdded: Math.floor(product.currentStockLevel * 0.4),
          purchasePricePerUnit: purchasePrice * 0.95,
          supplier: 'Metro Distributors',
          dateReceived: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          branchId: branch.id,
        },
      ];
    });
    await prisma.inventoryBatch.createMany({ data: batchData });
  }

  console.log('Created inventory batches for Company 1');

  // Create Sales Data for Company 1
  const now = new Date();

  // Cashiers per branch
  const branchCashiers = [
    { branch: mainBranch, cashiers: [cashier1, cashier2, manager], products: mainProducts },
    { branch: branchEast, cashiers: [eastCashier], products: eastProducts },
    { branch: branchWest, cashiers: [westCashier], products: westProducts },
  ];

  for (const { branch, cashiers, products } of branchCashiers) {
    for (let day = 0; day < 30; day++) {
      const salesThisDay = Math.floor(Math.random() * 3) + 1;
      for (let s = 0; s < salesThisDay; s++) {
        const saleDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
        saleDate.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));

        const numItems = Math.floor(Math.random() * 4) + 1;
        const selectedProducts = [...products]
          .sort(() => Math.random() - 0.5)
          .slice(0, numItems);

        const filteredProducts = selectedProducts.filter(
          (p) => p.sku !== 'MIS-001' || Math.random() < 0.05
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

        const discount = Math.random() < 0.2 ? totalAmount * 0.1 : 0;
        const userId = cashiers[Math.floor(Math.random() * cashiers.length)].id;

        const sale = await prisma.sale.create({
          data: {
            totalAmount: totalAmount - discount,
            discount,
            saleDate,
            userId,
            branchId: branch.id,
            companyId: company1.id,
          },
        });

        for (const item of items) {
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
    }
  }

  console.log('Created sales data for Company 1');

  // Create Shrinkage Records for Company 1
  const shrinkageReasons = ['Stolen', 'Expired', 'Damaged'];

  for (const { branch, products } of branchCashiers) {
    const nonDeadStock = products.filter((p) => p.sku !== 'MIS-001');
    for (let day = 0; day < 20; day++) {
      if (Math.random() < 0.4) {
        const product = nonDeadStock[Math.floor(Math.random() * nonDeadStock.length)];
        const reason = shrinkageReasons[Math.floor(Math.random() * shrinkageReasons.length)];
        const quantityLost = Math.floor(Math.random() * 5) + 1;

        await prisma.shrinkage.create({
          data: {
            productId: product.id,
            quantityLost,
            reason,
            dateRecorded: new Date(now.getTime() - day * 24 * 60 * 60 * 1000),
            branchId: branch.id,
          },
        });
      }
    }
  }

  console.log('Created shrinkage records for Company 1');

  // ==========================================
  // Company 2: Mama Jane's Shop
  // ==========================================
  const company2 = await prisma.company.create({
    data: {
      name: "Mama Jane's Shop",
      industry: 'Retail',
      email: 'mamajane@gmail.com',
      phone: '+255 788 123 456',
      address: '45 Kijiji Street, Neighborhood Market',
      plan: 'free',
      isActive: true,
    },
  });

  console.log("Created Company 2: Mama Jane's Shop");

  // Create single branch for Company 2
  const mamaJaneBranch = await prisma.branch.create({
    data: {
      name: "Mama Jane's Main Shop",
      code: 'MJHQ',
      address: '45 Kijiji Street, Neighborhood Market',
      phone: '+255 788 123 456',
      isHeadOffice: true,
      isActive: true,
      companyId: company2.id,
    },
  });

  console.log('Created 1 branch for Company 2');

  // Create admin user for Company 2
  const mamaJaneAdmin = await prisma.user.create({
    data: {
      email: 'mamajane@gmail.com',
      name: 'Mama Jane',
      passwordHash: '$2a$10$dummyhashformamajane',
      role: 'CompanyAdmin',
      branchId: mamaJaneBranch.id,
      companyId: company2.id,
    },
  });

  console.log('Created 1 user for Company 2');

  // Create a few products for Company 2
  const mamaJaneProductsDef = [
    { name: 'Maize Flour 2kg', sku: 'MJ-FLR-001', barcode: '9901234567001', category: 'Grains', stock: 50, reorder: 15, price: 2.00 },
    { name: 'Cooking Fat 500g', sku: 'MJ-FAT-001', barcode: '9901234567002', category: 'Grains', stock: 30, reorder: 10, price: 2.50 },
    { name: 'Salt 1kg', sku: 'MJ-SLT-001', barcode: '9901234567003', category: 'Grains', stock: 40, reorder: 10, price: 0.50 },
    { name: 'Tea Leaves 200g', sku: 'MJ-TEA-001', barcode: '9901234567004', category: 'Beverages', stock: 25, reorder: 8, price: 1.80 },
    { name: 'Sugar 1kg', sku: 'MJ-SGR-001', barcode: '9901234567005', category: 'Grains', stock: 35, reorder: 12, price: 1.40 },
    { name: 'Soap Bar', sku: 'MJ-SOP-001', barcode: '9901234567006', category: 'Household', stock: 20, reorder: 8, price: 0.90 },
    { name: 'Milk 500ml', sku: 'MJ-MLK-001', barcode: '9901234567007', category: 'Dairy', stock: 5, reorder: 15, price: 1.00 },
    { name: 'Bread Loaf', sku: 'MJ-BRD-001', barcode: '9901234567008', category: 'Bakery', stock: 10, reorder: 10, price: 1.50 },
  ];

  const mamaJaneProducts = await Promise.all(
    mamaJaneProductsDef.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          sku: p.sku,
          barcode: p.barcode,
          category: p.category,
          currentStockLevel: p.stock,
          reorderThreshold: p.reorder,
          defaultSalePrice: p.price,
          branchId: mamaJaneBranch.id,
          companyId: company2.id,
          isActive: true,
        },
      })
    )
  );

  console.log(`Created ${mamaJaneProducts.length} products for Company 2`);

  // Create inventory batches for Company 2
  const mamaJaneBatchData = mamaJaneProducts.map((product) => ({
    productId: product.id,
    quantityAdded: product.currentStockLevel,
    purchasePricePerUnit: product.defaultSalePrice * 0.6,
    supplier: 'Local Wholesale Market',
    dateReceived: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    branchId: mamaJaneBranch.id,
  }));
  await prisma.inventoryBatch.createMany({ data: mamaJaneBatchData });

  console.log('Created inventory batches for Company 2');

  // Create some sales for Company 2
  for (let day = 0; day < 14; day++) {
    const salesThisDay = Math.floor(Math.random() * 2) + 1;
    for (let s = 0; s < salesThisDay; s++) {
      const saleDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);
      saleDate.setHours(Math.floor(Math.random() * 10) + 7, Math.floor(Math.random() * 60));

      const numItems = Math.floor(Math.random() * 3) + 1;
      const selectedProducts = [...mamaJaneProducts]
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);

      let totalAmount = 0;
      const items: Array<{
        productId: string;
        quantitySold: number;
        salePricePerUnit: number;
        costPricePerUnit: number;
      }> = [];

      for (const product of selectedProducts) {
        const quantitySold = Math.floor(Math.random() * 3) + 1;
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

      const sale = await prisma.sale.create({
        data: {
          totalAmount,
          discount: 0,
          saleDate,
          userId: mamaJaneAdmin.id,
          branchId: mamaJaneBranch.id,
          companyId: company2.id,
        },
      });

      for (const item of items) {
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
  }

  console.log('Created sales data for Company 2');

  // Create some shrinkage for Company 2
  for (let day = 0; day < 10; day++) {
    if (Math.random() < 0.3) {
      const product = mamaJaneProducts[Math.floor(Math.random() * mamaJaneProducts.length)];
      const reason = shrinkageReasons[Math.floor(Math.random() * shrinkageReasons.length)];
      const quantityLost = Math.floor(Math.random() * 2) + 1;

      await prisma.shrinkage.create({
        data: {
          productId: product.id,
          quantityLost,
          reason,
          dateRecorded: new Date(now.getTime() - day * 24 * 60 * 60 * 1000),
          branchId: mamaJaneBranch.id,
        },
      });
    }
  }

  console.log('Created shrinkage records for Company 2');

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n=== Seed Data Summary ===');
  console.log(`Companies: ${await prisma.company.count()}`);
  console.log(`Branches: ${await prisma.branch.count()}`);
  console.log(`Users: ${await prisma.user.count()}`);
  console.log(`Products: ${await prisma.product.count()}`);
  console.log(`Inventory Batches: ${await prisma.inventoryBatch.count()}`);
  console.log(`Sales: ${await prisma.sale.count()}`);
  console.log(`Sale Items: ${await prisma.saleItem.count()}`);
  console.log(`Shrinkage Records: ${await prisma.shrinkage.count()}`);
  console.log('\nSeed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
