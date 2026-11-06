import { connection } from "next/server";
import { fail, ok } from "@/lib/api";
import { radar } from "@/lib/search/service";

export async function GET() {
  await connection();
  try {
    return ok(await radar());
  } catch (e) {
    return fail(e);
  }
}
