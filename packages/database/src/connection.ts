import { ConfigurationError } from "@oses/shared";

export interface MysqlConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  connectionLimit: number;
}

/** Parse a mysql:// URL (as used by Prisma Migrate) into driver options for the MariaDB adapter. */
export function parseMysqlUrl(url: string | undefined, connectionLimit = 5): MysqlConnectionOptions {
  if (!url) throw new ConfigurationError("DATABASE_URL is not configured");
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new ConfigurationError("DATABASE_URL is not a valid mysql:// URL");
  }
  if (!/^mysql:$/.test(u.protocol)) throw new ConfigurationError("DATABASE_URL must start with mysql://");
  const database = decodeURIComponent(u.pathname.replace(/^\//, ""));
  if (!database) throw new ConfigurationError("DATABASE_URL must include a database name");
  const sslParam = u.searchParams.get("sslaccept") ?? u.searchParams.get("ssl");
  const limitParam = u.searchParams.get("connection_limit");
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port ? Number.parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username || "root"),
    password: decodeURIComponent(u.password || ""),
    database,
    ssl: sslParam === "strict" ? { rejectUnauthorized: true } : sslParam === "accept_invalid_certs" ? { rejectUnauthorized: false } : undefined,
    connectionLimit: limitParam ? Number.parseInt(limitParam, 10) : connectionLimit,
  };
}
