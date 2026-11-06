import { migrate } from "../src/lib/db/migrate";
import { pool } from "../src/lib/db";

migrate()
  .then((a) => console.log(a.length ? `Migrações aplicadas: ${a.join(", ")}` : "Banco já atualizado."))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
