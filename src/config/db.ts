import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    // hosted MySQL (TiDB Cloud, PlanetScale, Aiven, ...) requires TLS
    ssl: process.env.DB_SSL === "true" ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Hosted DBs run in UTC; CURDATE()/NOW() drive "today's arrivals", revenue days etc.,
// so pin each session to the hotel time zone (e.g. DB_TIMEZONE=+05:30 for IST).
if (process.env.DB_TIMEZONE) {
    db.pool.on("connection", (conn) => {
        conn.query("SET time_zone = ?", [process.env.DB_TIMEZONE]);
    });
}
