import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { initializeSocket } from "./socket/socket";

// hosting platforms (Render, Railway, ...) inject PORT
const PORT = process.env.PORT || 7777;

// create http server
const server = http.createServer(app);

// initialize socket.io
initializeSocket(server);

server.listen(PORT, () => {
    console.log(
        "DB connecting as:",
        process.env.DB_USER,
        "to",
        process.env.DB_HOST
    );

    console.log(
        `Server running on http://localhost:${PORT}`
    );
});