import { Router } from "express";
import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { logger } from "../lib/logger";

interface RoomState {
  cameraSocketId: string | null;
  viewerCount: number;
}

const rooms = new Map<string, RoomState>();

export function setupSocketIO(httpServer: HttpServer): void {
  const io = new Server(httpServer, {
    path: "/api/socket.io/",
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Socket connected");

    socket.on("camera-join", ({ roomId }: { roomId: string }) => {
      const room = rooms.get(roomId) ?? { cameraSocketId: null, viewerCount: 0 };
      room.cameraSocketId = socket.id;
      rooms.set(roomId, room);
      socket.join(`room:${roomId}`);
      logger.info({ roomId, socketId: socket.id }, "Camera joined room");
      io.to(`room:${roomId}`).emit("camera-online", { roomId });
    });

    socket.on("viewer-join", ({ roomId }: { roomId: string }) => {
      const existing = rooms.get(roomId);
      socket.join(`room:${roomId}`);
      if (existing) {
        existing.viewerCount++;
        rooms.set(roomId, existing);
      } else {
        rooms.set(roomId, { cameraSocketId: null, viewerCount: 1 });
      }
      const isOnline = !!(rooms.get(roomId)?.cameraSocketId);
      socket.emit(isOnline ? "camera-online" : "camera-offline", { roomId });
      logger.info({ roomId, socketId: socket.id }, "Viewer joined room");
    });

    socket.on("frame", ({ roomId, frame }: { roomId: string; frame: string }) => {
      socket.to(`room:${roomId}`).emit("frame", { frame });
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Socket disconnected");
      for (const [roomId, room] of rooms.entries()) {
        if (room.cameraSocketId === socket.id) {
          room.cameraSocketId = null;
          rooms.set(roomId, room);
          io.to(`room:${roomId}`).emit("camera-offline", { roomId });
          logger.info({ roomId }, "Camera went offline");
        }
      }
    });
  });
}

export const streamRouter = Router();

streamRouter.get("/view/:roomId", (req, res) => {
  const { roomId } = req.params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RemoteCam Live — ${roomId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#0a0f1a;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
    .header{position:fixed;top:0;left:0;right:0;padding:14px 24px;display:flex;align-items:center;gap:10px;background:rgba(10,15,26,0.85);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,0.06)}
    .dot{width:9px;height:9px;border-radius:50%;background:#374151;transition:background 0.3s}
    .dot.live{background:#ff3b3b;animation:pulse 1.2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
    .badge{font-size:11px;font-weight:700;letter-spacing:0.12em;color:#ff3b3b;background:rgba(255,59,59,0.12);border:1px solid rgba(255,59,59,0.25);padding:3px 8px;border-radius:5px}
    .badge.offline{color:#6b7280;background:rgba(107,114,128,0.1);border-color:rgba(107,114,128,0.2)}
    .room-label{margin-left:auto;font-family:monospace;font-size:13px;color:#6b7280}
    .room-label span{color:#d1d5db;font-weight:600}
    #wrap{width:100%;max-width:900px;padding:80px 16px 16px;display:flex;align-items:center;justify-content:center;flex:1}
    #stream-box{width:100%;aspect-ratio:4/3;background:#111827;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;position:relative}
    #stream{width:100%;height:100%;object-fit:cover;display:none}
    #status{text-align:center;padding:32px}
    #status h2{font-size:22px;font-weight:600;margin-bottom:8px}
    #status p{font-size:14px;color:#6b7280;margin-top:6px}
    .code{font-family:monospace;font-size:36px;font-weight:800;letter-spacing:0.18em;color:#ff3b3b;margin:20px 0 4px}
    .hint{font-size:12px;color:#4b5563}
  </style>
</head>
<body>
  <div class="header">
    <div class="dot" id="dot"></div>
    <span class="badge offline" id="badge">OFFLINE</span>
    <span style="font-size:14px;font-weight:600;color:#d1d5db;margin-left:4px">REMOTECAM</span>
    <span class="room-label">Room&nbsp;<span>${roomId}</span></span>
  </div>
  <div id="wrap">
    <div id="stream-box">
      <img id="stream" alt="Live feed" />
      <div id="status">
        <h2>Waiting for camera</h2>
        <p>Open RemoteCam on your phone and go live</p>
        <div class="code">${roomId}</div>
        <div class="hint">Enter this code in the app to start streaming</div>
      </div>
    </div>
  </div>
  <script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
  <script>
    const roomId="${roomId}";
    const socket=io(window.location.origin,{path:"/api/socket.io/",transports:["websocket","polling"]});
    const img=document.getElementById("stream");
    const statusDiv=document.getElementById("status");
    const dot=document.getElementById("dot");
    const badge=document.getElementById("badge");

    socket.on("connect",()=>{socket.emit("viewer-join",{roomId})});
    socket.on("frame",({frame})=>{
      if(img.style.display==="none"){img.style.display="block";statusDiv.style.display="none"}
      img.src="data:image/jpeg;base64,"+frame;
    });
    socket.on("camera-online",()=>{
      dot.classList.add("live");badge.textContent="LIVE";badge.classList.remove("offline");
    });
    socket.on("camera-offline",()=>{
      dot.classList.remove("live");badge.textContent="OFFLINE";badge.classList.add("offline");
      img.style.display="none";statusDiv.style.display="block";
      statusDiv.querySelector("h2").textContent="Camera offline";
      statusDiv.querySelector("p").textContent="The camera disconnected";
    });
  </script>
</body>
</html>`;

  res.send(html);
});
