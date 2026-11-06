import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { search } from "@/lib/search/service";

const num = z.coerce.number().finite().nonnegative().optional();
const schema = z.object({
  mode: z.enum(["pc", "pc-monitor", "monitor", "kit", "garimpo-entrega"]),
  entrega: z.enum(["entrega", "ambos", "retirada"]).optional(),
  tier: z.enum(["pc-500", "pc-700", "pc-1000", "monitor-200", "kit-barato"]).optional(),
  q: z.string().max(120).optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/).optional(),
  minPrice: num,
  maxPrice: num,
  cpu: z.string().max(40).optional(),
  gpu: z.string().max(40).optional(),
  minRam: num,
  minStorage: num,
  brand: z.string().max(40).optional(),
  stores: z.string().max(300).optional(),
  freeShipping: z.enum(["1", "true"]).optional(),
  origin: z.enum(["BR", "INTL"]).optional(),
  maxDays: num,
  resolution: z.string().max(30).optional(),
  minRefresh: num,
  minScore: num,
  kit: z.enum(["only", "exclude"]).optional(),
  unconfirmed: z.enum(["1", "true"]).optional(),
  sort: z.enum(["score", "price", "performance", "delivery", "discount", "value"]).optional(),
  garimpo: z.enum(["1", "true"]).optional(),
  cond: z.string().max(120).optional(),
  uf: z.string().max(120).optional(),
  seller: z.string().max(60).optional(),
  pickup: z.enum(["1", "true"]).optional(),
  page: z.coerce.number().int().min(1).max(100).optional(),
  pageSize: z.coerce.number().int().min(6).max(60).optional(),
  refresh: z.enum(["1", "true"]).optional(),
});

export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
    const p = schema.parse(params);
    const res = await search({
      mode: p.mode,
      text: p.q,
      cep: p.cep?.replace("-", ""),
      minPrice: p.minPrice,
      maxPrice: p.maxPrice,
      cpu: p.cpu,
      gpu: p.gpu,
      minRam: p.minRam,
      minStorage: p.minStorage,
      brand: p.brand,
      stores: p.stores?.split(",").filter(Boolean),
      freeShipping: !!p.freeShipping,
      origin: p.origin,
      maxDeliveryDays: p.maxDays,
      resolution: p.resolution,
      minRefresh: p.minRefresh,
      minScore: p.minScore,
      includesMonitor: p.kit === "only" ? true : p.kit === "exclude" ? false : undefined,
      includeUnconfirmed: !!p.unconfirmed,
      sort: p.sort,
      garimpo: !!p.garimpo,
      deliveryMode: p.entrega,
      tier: p.tier,
      conditions: p.cond?.split(",").filter(Boolean),
      ufs: p.uf?.split(",").filter(Boolean),
      sellerTypes: p.seller?.split(",").filter(Boolean),
      pickup: !!p.pickup,
      page: p.page,
      pageSize: p.pageSize,
      refresh: !!p.refresh,
    });
    return ok(res);
  } catch (e) {
    return fail(e);
  }
}
