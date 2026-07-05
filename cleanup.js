import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(projectDir, "data");

// Xóa các file không được chỉnh sửa trong vòng 30 ngày (tính bằng mili-giây)
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function cleanup() {
  try {
    const files = await readdir(dataDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".txt")) continue;
      
      const filePath = path.join(dataDir, file);
      const fileStat = await stat(filePath);
      
      const ageMs = now - fileStat.mtimeMs;
      if (ageMs > THIRTY_DAYS_MS) {
        await unlink(filePath);
        console.log(`Deleted old note: ${file}`);
        deletedCount++;
      }
    }
    
    console.log(`Cleanup complete. Deleted ${deletedCount} file(s).`);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("Data directory does not exist, nothing to clean.");
      return;
    }
    console.error("Error during cleanup:", error);
    process.exit(1);
  }
}

cleanup();
