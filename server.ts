import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("acolitos.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS acolytes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS absences (
    id TEXT PRIMARY KEY,
    acolyte_id TEXT NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'missa',
    FOREIGN KEY (acolyte_id) REFERENCES acolytes(id)
  );
`);

// Migration: Add category column if it doesn't exist (for existing databases)
try {
  db.prepare("SELECT category FROM absences LIMIT 1").get();
} catch (e) {
  console.log("Migration: Adding 'category' column to 'absences' table...");
  try {
    db.exec("ALTER TABLE absences ADD COLUMN category TEXT NOT NULL DEFAULT 'missa'");
  } catch (alterErr) {
    console.error("Migration failed:", alterErr);
  }
}

const INITIAL_NAMES = [
  "Lincoln", "Maria Clara Duque", "Miguel Melo", "Rodrigo", "Lilian", 
  "Gabriel luiz", "Jhemilly", "Maria Livia", "Lucas", "Maria Clara Iung", 
  "Maria luiza", "Matheus", "Nathan", "Sarah", "Sara", 
  "Ana Luiza Werneck", "Ana Luiza Souza", "Gabriel Garcia", "Ana Carla", "Gabriela",
  "Mariana"
];

// Seed initial names if empty
const count = db.prepare("SELECT count(*) as count FROM acolytes").get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare("INSERT INTO acolytes (id, name) VALUES (?, ?)");
  INITIAL_NAMES.forEach(name => {
    insert.run(Math.random().toString(36).substr(2, 9), name);
  });
} else {
  // Ensure Mariana is added if she's not there yet
  const checkMariana = db.prepare("SELECT * FROM acolytes WHERE name = ?").get("Mariana");
  if (!checkMariana) {
    db.prepare("INSERT INTO acolytes (id, name) VALUES (?, ?)").run(Math.random().toString(36).substr(2, 9), "Mariana");
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  function getFullState() {
    const acolytes = db.prepare("SELECT * FROM acolytes").all() as { id: string, name: string }[];
    const absences = db.prepare("SELECT * FROM absences").all() as { id: string, acolyte_id: string, date: string, type: string, category: string }[];
    
    return acolytes.map(a => ({
      ...a,
      absences: absences.filter(abs => abs.acolyte_id === a.id)
    }));
  }

  function broadcast(data: any) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  wss.on("connection", (ws) => {
    console.log("Client connected");
    // Send initial state
    ws.send(JSON.stringify({ type: "INIT", data: getFullState() }));

    ws.on("message", (message) => {
      try {
        const { type, payload } = JSON.parse(message.toString());
        
        if (type === "ADD_ABSENCE") {
          const { acolyteId, absence } = payload;
          if (!acolyteId || !absence || !absence.id || !absence.date || !absence.type) {
            console.error("Invalid ADD_ABSENCE payload:", payload);
            return;
          }
          
          try {
            db.prepare("INSERT INTO absences (id, acolyte_id, date, type, category) VALUES (?, ?, ?, ?, ?)")
              .run(absence.id, acolyteId, absence.date, absence.type, absence.category || 'missa');
            broadcast({ type: "STATE_UPDATE", data: getFullState() });
          } catch (dbErr) {
            console.error("Database error adding absence:", dbErr);
          }
        }
        
        if (type === "REMOVE_ABSENCE") {
          const { absenceId } = payload;
          db.prepare("DELETE FROM absences WHERE id = ?").run(absenceId);
          broadcast({ type: "STATE_UPDATE", data: getFullState() });
        }

        if (type === "IMPORT_DATA") {
           // Clear and replace
           db.prepare("DELETE FROM absences").run();
           db.prepare("DELETE FROM acolytes").run();
           
           const insertAcolyte = db.prepare("INSERT INTO acolytes (id, name) VALUES (?, ?)");
           const insertAbsence = db.prepare("INSERT INTO absences (id, acolyte_id, date, type, category) VALUES (?, ?, ?, ?, ?)");
           
           payload.forEach((a: any) => {
             insertAcolyte.run(a.id, a.name);
             a.absences.forEach((abs: any) => {
               insertAbsence.run(abs.id, a.id, abs.date, abs.type, abs.category || 'missa');
             });
           });
           broadcast({ type: "STATE_UPDATE", data: getFullState() });
        }
      } catch (err) {
        console.error("WS Message error:", err);
      }
    });
  });

  const distPath = path.join(__dirname, "dist");
  const isProduction = process.env.NODE_ENV === "production";

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      env: process.env.NODE_ENV,
      isProduction,
      distPath,
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(path.join(distPath, "index.html"))
    });
  });

  if (isProduction) {
    console.log(`[PROD] Serving static files from: ${distPath}`);
    
    // Serve static files from dist
    app.use(express.static(distPath));

    // SPA Fallback: handle all other routes by serving index.html
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`Error: index.html not found at ${indexPath}`);
        res.status(404).send("Erro: O aplicativo não foi compilado corretamente. Por favor, aguarde o término do build.");
      }
    });
  } else {
    console.log("[DEV] Starting with Vite middleware");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to load Vite middleware:", e);
      app.get("*", (req, res) => res.send("Vite is loading... please refresh."));
    }
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Unhandled server error:", err);
    res.status(500).send("Erro interno do servidor.");
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (0.0.0.0)`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
