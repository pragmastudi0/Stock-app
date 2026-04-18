export type StockAppStore = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
};

export type StockAppProduct = {
  id: string;
  store_id: string;
  barcode: string;
  name: string;
  brand: string | null;
  category: string | null;
  price: number;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type StockAppSale = {
  id: string;
  store_id: string;
  created_at: string;
  total: number;
};

export type StockAppSaleItem = {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
};
