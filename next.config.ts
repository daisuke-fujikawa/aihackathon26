import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev サーバーへ LAN IP からアクセスする際のクロスオリジン許可
  // （スマホ実機確認用）
  allowedDevOrigins: ["192.168.0.12"],
};

export default nextConfig;
