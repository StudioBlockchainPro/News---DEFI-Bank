// DeFi Bank News Portal - Share Generator Initial Sync
import "dotenv/config";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'src/data/news.json');
const shareDir = path.join(__dirname, 'public/share');

if (!fs.existsSync(shareDir)) {
  fs.mkdirSync(shareDir, { recursive: true });
}

if (fs.existsSync(dbPath)) {
  const news = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  
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
  console.log(`✅ ${news.length} arquivos de compartilhamento gerados com sucesso.`);
} else {
  console.log("⚠️ Arquivo news.json não encontrado.");
}
