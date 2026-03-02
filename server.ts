import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { WebSocketServer, WebSocket } from "ws";
import fs from "fs";
import { createServer } from "http";

const execPromise = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get the yt-dlp command
async function getYtDlpCommand() {
  try {
    await execPromise("yt-dlp --version");
    return "yt-dlp";
  } catch {
    return "npx -y @shoginn/yt-dlp-node";
  }
}

const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use("/downloads", express.static(DOWNLOADS_DIR));

  // WebSocket handling
  wss.on("connection", (ws) => {
    console.log("New WebSocket connection");

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "start_download") {
          const { url, formatId, cookies, downloadId } = data;
          const ytDlpCmd = await getYtDlpCommand();
          
          let commandArgs = ["-f", formatId, "--newline", "--progress", "-o", path.join(DOWNLOADS_DIR, "%(title)s.%(ext)s"), url];
          
          if (cookies) {
            commandArgs.push("--cookies-content", cookies);
          }

          // Use the determined command
          let child;
          if (ytDlpCmd === "yt-dlp") {
            child = spawn("yt-dlp", commandArgs);
          } else {
            child = spawn("npx", ["-y", "@shoginn/yt-dlp-node", ...commandArgs]);
          }

          child.stdout.on("data", (chunk) => {
            const line = chunk.toString();
            // Parse progress: [download]  12.3% of 100.00MiB at  1.23MiB/s ETA 01:23
            const match = line.match(/\[download\]\s+(\d+\.\d+)%/);
            if (match) {
              const progress = parseFloat(match[1]);
              ws.send(JSON.stringify({ type: "progress", downloadId, progress }));
            }
          });

          child.stderr.on("data", (chunk) => {
            console.error(`yt-dlp stderr: ${chunk}`);
          });

          child.on("close", (code) => {
            if (code === 0) {
              // Try to find the file in the downloads directory
              // yt-dlp usually prints the destination: [download] Destination: ...
              // But we can also just look for the most recent file if needed
              // For now, let's just send a generic success with a hint
              ws.send(JSON.stringify({ 
                type: "complete", 
                downloadId, 
                message: "Download finished!",
                // We don't have the exact filename easily without parsing more, 
                // but we can send the downloadId or a placeholder
                url: `/downloads/` 
              }));
            } else {
              ws.send(JSON.stringify({ type: "error", downloadId, message: `Download failed with code ${code}` }));
            }
          });
        }
      } catch (err) {
        console.error("WS error:", err);
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Get video info using yt-dlp
  app.post("/api/info", async (req, res) => {
    const { url, cookies } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }
    
    try {
      const ytDlpCmd = await getYtDlpCommand();
      let command = `${ytDlpCmd} -j "${url}"`;
      
      // Add cookies if provided
      if (cookies) {
        command += ` --cookies-content "${cookies.replace(/"/g, '\\"')}"`;
      }

      const { stdout } = await execPromise(command);
      const info = JSON.parse(stdout);
      
      res.json({
        title: info.title,
        thumbnail: info.thumbnail,
        duration: info.duration,
        uploader: info.uploader,
        formats: info.formats
          .filter((f: any) => f.vcodec !== 'none' || f.acodec !== 'none')
          .map((f: any) => ({
            id: f.format_id,
            quality: f.format_note || f.resolution || 'unknown',
            ext: f.ext,
            url: f.url,
            filesize: f.filesize || f.filesize_approx || 0,
            vcodec: f.vcodec,
            acodec: f.acodec
          }))
          .sort((a: any, b: any) => (b.filesize || 0) - (a.filesize || 0))
      });
    } catch (error: any) {
      console.error("yt-dlp error:", error);
      res.status(500).json({ 
        error: "Failed to fetch video info. Make sure the URL is valid and yt-dlp is installed.",
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
