// Preloaded into WordPress Playground by start.mjs (node --require).
// Playground listens on every network interface by default, which on shared conference
// Wi-Fi would let anyone nearby reach your demo site (and its public demo passwords).
// This makes any server that doesn't pick a host listen on 127.0.0.1 only.
"use strict";
const net = require("node:net");
const listen = net.Server.prototype.listen;

net.Server.prototype.listen = function (...args) {
  const first = args[0];
  if (first === undefined || typeof first === "function") {
    args.unshift(0, "127.0.0.1");
  } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    if (typeof args[1] !== "string") args.splice(1, 0, "127.0.0.1");
  } else if (first && typeof first === "object" && first.path == null && first.host == null && first.port !== undefined) {
    args[0] = { ...first, host: "127.0.0.1" };
  }
  return listen.apply(this, args);
};
