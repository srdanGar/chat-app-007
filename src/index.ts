export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.clients = new Set();
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket required", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.clients.add(server);

    const history = (await this.state.storage.get("messages")) || [];
    server.send(
      JSON.stringify({
        type: "history",
        messages: history,
      })
    );

    server.addEventListener("message", async (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "chat") {
        await this.handleMessage(msg);
      }
    });

    server.addEventListener("close", () => {
      this.clients.delete(server);
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleMessage(msg) {
    const messages = (await this.state.storage.get("messages")) || [];

    messages.push(msg);
    await this.state.storage.put("messages", messages.slice(-100));

    this.broadcast({ type: "chat", message: msg });
  }

  broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const client of this.clients) {
      client.send(data);
    }
  }
}
export default {
  fetch(request, env) {
    const id = env.CHAT.idFromName("main");
    return env.CHAT.get(id).fetch(request);
  },
};
