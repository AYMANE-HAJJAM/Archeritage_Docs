import "dotenv/config";
import { db } from "../../lib/db";
import { v2 as cloudinary } from "cloudinary";

async function main() {
const file = await db.file.findFirst({
  where: { storageProvider: "CLOUDINARY", mimeType: { startsWith: "image/" } },
});
if (!file) throw new Error("no image");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  url_analytics: false,
});

const urls = {
  plain: cloudinary.url(file.storageKey, {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    secure: true,
    version: Number(file.storageVersion),
  }),
  thumbAuto: cloudinary.url(file.storageKey, {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    secure: true,
    version: Number(file.storageVersion),
    transformation: [
      { width: 112, height: 112, crop: "fill", quality: "auto", fetch_format: "auto" },
    ],
  }),
  thumbJpg: cloudinary.url(file.storageKey, {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    secure: true,
    transformation: [{ width: 112, height: 112, crop: "fill", quality: "auto", format: "jpg" }],
  }),
  noVersion: cloudinary.url(file.storageKey, {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    secure: true,
  }),
  noExt: cloudinary.url(file.storageKey.replace(/\.jpg$/i, ""), {
    type: "authenticated",
    resource_type: "image",
    sign_url: true,
    secure: true,
    format: "jpg",
  }),
};

console.log("keyStarts", file.storageKey.startsWith("saf/"), "len", file.storageKey.length);
try {
  const info = await cloudinary.api.resource(file.storageKey, {
    resource_type: "image",
    type: "authenticated",
  });
  console.log("api", info.resource_type, info.type, info.format, "version", info.version);
} catch (error) {
  console.log("api-error", error instanceof Error ? error.message.slice(0, 180) : "unknown");
}
const sample = urls.plain.split("?")[0];
const body = await fetch(sample).then((res) => res.text());
console.log("body", body.slice(0, 200).replace(/\s+/g, " "));
const dl = cloudinary.utils.private_download_url(file.storageKey, "jpg", {
  resource_type: "image",
  type: "authenticated",
  expires_at: Math.floor(Date.now() / 1000) + 120,
});
const dlRes = await fetch(dl);
console.log("private", dlRes.status, dlRes.headers.get("content-type"));

await db.$disconnect();
}

main();
