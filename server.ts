// DeFi Bank News Portal - Server Initial Sync
import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Path
const dbPath = path.join(__dirname, "src/data/news.json");

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize DB if not exists
if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
}

const getNews = () => {
  try {
    const data = fs.readFileSync(dbPath, "utf-8");
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

const saveNews = (news: any[]) => {
  fs.writeFileSync(dbPath, JSON.stringify(news, null, 2));
  generateShareFiles(news);
};

const generateShareFiles = (news: any[]) => {
  const shareDir = path.join(__dirname, "public/share");
  if (!fs.existsSync(shareDir)) {
    fs.mkdirSync(shareDir, { recursive: true });
  }

  news.forEach((item: any) => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${item.title}</title>
    <meta name="description" content="${item.excerpt || ""}">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${item.title}">
    <meta property="og:description" content="${item.excerpt || ""}">
    <meta property="og:image" content="${item.image}">
    <script>window.location.href = "/?news=${item.id}";</script>
</head>
<body>
    <h1>${item.title}</h1>
</body>
</html>`;
    fs.writeFileSync(path.join(shareDir, `${item.id}.html`), htmlContent);
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'defibank-news-secret-2026'],
    maxAge: 24 * 60 * 60 * 1000,
    secure: true,
    sameSite: 'none'
  }));

  const isAdmin = (req: any) => {
    return req.session && req.session.user && req.session.isAdmin;
  };

  // Auth Endpoints
  app.get("/api/auth/google", (req, res) => {
    const rootUrl = "https://accounts.google.com/o/oauth2/v2/auth";
    const options = {
      redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      access_type: "offline",
      response_type: "code",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    };
    const qs = new URLSearchParams(options);
    res.redirect(`${rootUrl}?${qs.toString()}`);
  });

  app.get("/api/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) return res.redirect("/");

    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          redirect_uri: `${process.env.APP_URL}/api/auth/callback`,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();

      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userRes.json();

      const authorizedEmails = (process.env.AUTHORIZED_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
      const isAuthorized = authorizedEmails.includes(googleUser.email.toLowerCase());

      if (isAuthorized) {
        req.session!.user = googleUser;
        req.session!.isAdmin = true;
        res.send(`<html><body><script>window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*'); window.close();</script></body></html>`);
      } else {
        res.status(403).send("Acesso negado. E-mail não autorizado.");
      }
    } catch (error) {
      res.status(500).send("Erro na autenticação.");
    }
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.session?.user || null, isAdmin: isAdmin(req) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // News API
  app.get("/api/news", (req, res) => {
    const news = getNews();
    generateShareFiles(news);
    res.json(news);
  });

  app.post("/api/news", (req, res) => {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });
    saveNews(req.body);
    res.json({ success: true });
  });

  // Serve public folder
  const publicDir = path.join(__dirname, "public");
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  app.use(express.static(publicDir));

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
