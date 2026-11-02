import { revalidateTag } from "next/cache";

export async function POST() {
  revalidateTag("catalog-products");
  return Response.json({ revalidated: true });
}
