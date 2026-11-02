import { unstable_cache } from "next/cache";
import { getProductsUncached } from "@/lib/catalog";

const getCachedProducts = unstable_cache(
  getProductsUncached,
  ["catalog-products"],
  { revalidate: 300, tags: ["catalog-products"] },
);

export function getProducts() {
  return getCachedProducts();
}
