import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { CartService } from './cart.service';

describe('CartService', () => {
  let service: CartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartService,
        {
          provide: PrismaService,
          useValue: {
            carts: { findUnique: jest.fn(), findFirst: jest.fn(), upsert: jest.fn() },
            cart_items: {
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            products: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<CartService>(CartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should serialize cart items without BigInt fields in the HTTP response', () => {
    const item = {
      id: 'item-1',
      quantity: 2,
      products: {
        id: 'product-1',
        name: 'Test Product',
        description: 'A product',
        price: 100n,
        discount: 10n,
        category_id: 7n,
        badge_id: 9n,
        product_images: [{ id: 1n, image_url: 'a.jpg', product_id: 'product-1' }],
        product_colors: [
          {
            id: 3n,
            stock: 5n,
            product_id: 'product-1',
            product_color_images: [{ id: 2n, image_url: 'b.jpg', color_id: 3n }],
          },
        ],
        categories: { id: 7n, name: 'Category' },
        badges: { id: 9n, name: 'Badge' },
      },
      product_colors: {
        id: 3n,
        stock: 5n,
        product_id: 'product-1',
        product_color_images: [{ id: 2n, image_url: 'b.jpg', color_id: 3n }],
      },
    } as any;

    const result = service['serializeCartItem'](item);

    expect(() => JSON.stringify(result)).not.toThrow();
    expect(result.product.categoryId).toBe(7);
    expect(result.product.badgeId).toBe(9);
    expect(result.product.category_id).toBeUndefined();
    expect(result.product.badge_id).toBeUndefined();
    expect(result.product.product_images[0].id).toBe(1);
    expect(result.product.product_colors[0].product_color_images[0].color_id).toBe(3);
    expect(result.color.id).toBe(3);
  });
});
