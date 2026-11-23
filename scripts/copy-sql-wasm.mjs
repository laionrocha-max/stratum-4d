import { copyFile } from "node:fs/promises";
import { join } from "node:path";

const destination = process.argv[2];
if (!destination) throw new Error("Missing destination for sql-wasm.wasm.");
await copyFile("node_modules/sql.js/dist/sql-wasm.wasm", join(destination, "sql-wasm.wasm"));
