import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['yjs', 'y-prosemirror', 'y-protocols', 'y-websocket', '@tiptap/extension-collaboration', '@tiptap/extension-collaboration-cursor'],
  allowedDevOrigins: ['10.216.138.1', '192.168.0.161', 'localhost', '127.0.0.1'],
};

export default nextConfig;
