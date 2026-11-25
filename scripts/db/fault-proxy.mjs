import net from "node:net";
// Test-only TCP fault switch. It never stops the shared PostgreSQL service.
export async function databaseFaultProxy(port) {
  let offline = false;
  const sockets = new Set();
  const server = net.createServer(client => {
    client.on("error", () => {});
    if (offline) { client.destroy(); return; }
    const upstream = net.connect({ host: "127.0.0.1", port });
    for (const socket of [client, upstream]) { sockets.add(socket); socket.on("error", () => socket.destroy()); socket.on("close", () => { sockets.delete(socket); client.destroy(); upstream.destroy(); }); }
    client.pipe(upstream); upstream.pipe(client);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  return { port: server.address().port, setOffline(value) { offline = value; if (offline) for (const socket of sockets) socket.destroy(); }, async close() { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); } };
}
