import QRCode from "qrcode";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = process.env.MEALPREP_PUBLIC_URL ?? "http://localhost:3200";
  const png = await QRCode.toBuffer(`${base}/m/${token}`, { type: "png", width: 240, margin: 1, color: { dark: "#1f1f1d", light: "#ffffff" } });
  return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}
