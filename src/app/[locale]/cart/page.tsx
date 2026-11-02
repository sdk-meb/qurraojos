import { CartPage } from "@/components/cart-page";
import { getProducts } from "@/lib/catalog-server";
import type { Locale } from "@/lib/locale";

export const dynamic = "force-dynamic";

export default async function CartRoute({ params }: { params: { locale: Locale } }) {
  const { products, demo, error } = await getProducts();
  return <CartPage locale={params.locale} products={products} demo={demo} catalogError={Boolean(error)} />;
}
