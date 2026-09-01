# Product Filtering from Next.js

This API supports filtering and sorting products with Axios.

## Endpoint

```text
GET http://localhost:3001/products
```

Supported query parameters:

| Parameter | Type | Example | Notes |
|---|---:|---|---|
| `page` | number | `1` | Starts at 1 |
| `limit` | number | `20` | Maximum 100 |
| `categoryId` | number | `1` | Category ID |
| `color` | string | `Red` | Matches color name or hex code |
| `minPrice` | number | `100` | Minimum product price |
| `maxPrice` | number | `1000` | Maximum product price |
| `search` | string | `shirt` | Searches product name only |
| `sort` | string | `newest` | `newest`, `price_asc`, `price_desc`, or `best_seller` |

The API response is wrapped by the global interceptor:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {
    "items": [],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}
```

## Axios Setup

Install Axios if it is not installed:

```bash
npm install axios
```

Create `src/lib/api.ts` in the Next.js project:

```ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  withCredentials: true,
});
```

Set the frontend environment variable:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

`withCredentials: true` allows Axios to send the authentication cookie used by this API.

## Product API Function

Create `src/lib/products.ts`:

```ts
import { api } from './api';

export type ProductSort =
  | 'newest'
  | 'price_asc'
  | 'price_desc'
  | 'best_seller';

export type ProductFilters = {
  page: number;
  limit: number;
  categoryId?: number;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sort: ProductSort;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  discount: number | null;
  category_id: number;
  product_images: { id: number; image_url: string }[];
  product_colors: {
    id: number;
    name: string | null;
    hex_code: string | null;
    stock: number;
    product_color_images: { id: number; image_url: string }[];
  }[];
};

type ProductListResponse = {
  data: {
    items: Product[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
};

export async function getProducts(filters: ProductFilters) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  );

  const response = await api.get<ProductListResponse>('/products', { params });
  return response.data.data;
}
```

## Next.js Client Component

This example works in an App Router client component. It resets to page 1 whenever a filter changes and waits briefly while the user types in the search field.

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getProducts, Product, ProductSort } from '@/lib/products';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [color, setColor] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ProductSort>('newest');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');

      try {
        const result = await getProducts({
          page,
          limit: 20,
          categoryId,
          color: color || undefined,
          minPrice,
          maxPrice,
          search: search || undefined,
          sort,
        });
        setProducts(result.items);
        setTotalPages(result.meta.totalPages);
      } catch {
        setError('Unable to load products.');
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [page, categoryId, color, minPrice, maxPrice, search, sort]);

  function updateFilter<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setCategoryId(undefined);
    setColor('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSearch('');
    setSort('newest');
    setPage(1);
  }

  return (
    <main>
      <input
        value={search}
        onChange={(event) => updateFilter(setSearch, event.target.value)}
        placeholder="Search product name"
      />

      <select
        value={categoryId ?? ''}
        onChange={(event) =>
          updateFilter(
            setCategoryId,
            event.target.value ? Number(event.target.value) : undefined,
          )
        }
      >
        <option value="">All categories</option>
        <option value="1">Category 1</option>
      </select>

      <input
        type="text"
        value={color}
        onChange={(event) => updateFilter(setColor, event.target.value)}
        placeholder="Color or hex code"
      />

      <input
        type="number"
        value={minPrice ?? ''}
        onChange={(event) =>
          updateFilter(
            setMinPrice,
            event.target.value ? Number(event.target.value) : undefined,
          )
        }
        placeholder="Minimum price"
      />

      <input
        type="number"
        value={maxPrice ?? ''}
        onChange={(event) =>
          updateFilter(
            setMaxPrice,
            event.target.value ? Number(event.target.value) : undefined,
          )
        }
        placeholder="Maximum price"
      />

      <select
        value={sort}
        onChange={(event) =>
          updateFilter(setSort, event.target.value as ProductSort)
        }
      >
        <option value="newest">Newest arrival</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="best_seller">Best seller</option>
      </select>

      <button type="button" onClick={clearFilters}>
        Clear filters
      </button>

      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}

      <section>
        {products.map((product) => (
          <article key={product.id}>
            <h2>{product.name}</h2>
            <p>{product.price}</p>
          </article>
        ))}
      </section>

      <button
        type="button"
        disabled={page <= 1 || loading}
        onClick={() => setPage((current) => current - 1)}
      >
        Previous
      </button>
      <span>
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages || loading}
        onClick={() => setPage((current) => current + 1)}
      >
        Next
      </button>
    </main>
  );
}
```

## Request Examples

```ts
// Search by product name
getProducts({ page: 1, limit: 20, search: 'shirt', sort: 'newest' });

// Filter by category and price
getProducts({
  page: 1,
  limit: 20,
  categoryId: 1,
  minPrice: 100,
  maxPrice: 1000,
  sort: 'price_asc',
});

// Best sellers in a color
getProducts({
  page: 1,
  limit: 20,
  color: 'Red',
  sort: 'best_seller',
});
```

## Important Notes

- Use `categoryId`, not a category name.
- Do not send empty strings for numeric fields such as `minPrice`, `maxPrice`, or `categoryId`.
- Change `page` back to `1` whenever a filter or sort value changes.
- `best_seller` uses ordered quantity and excludes cancelled orders.
- The backend must be running on port `3001`, or `NEXT_PUBLIC_API_URL` must point to the correct API URL.
