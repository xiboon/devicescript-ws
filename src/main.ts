import { randomBuffer } from "@devicescript/crypto"
import { type Socket, URL, connect } from "@devicescript/net"
import { Number } from "@devicescript/runtime"
import { decodeFrame, encodeFrame } from "./encoders"
import { base64Encode } from "./util"

export class WebSocket {
    socket: Socket
    state: "CONNECTING" | "OPEN" | "CLOSING" | "CLOSED" = "CLOSED"
    constructor(public uri: URL) {}
    async open() {
        this.state = "CONNECTING"
        this.socket = await connect({
            host: this.uri.hostname,
            port: Number.parseInt(this.uri.port) || 443,
            proto: this.uri.protocol === "wss:" ? "tls" : "tcp",
        })
        const socket = this.socket
        socket.onclose.subscribe(async err => {
            await socket.close()
        })
        socket.onmessage.subscribe(this.receive)
        const headers: Record<string, string> = {
            Host: `${this.uri.hostname}:${this.uri.port}`,
            Upgrade: "websocket",
            Connection: "Upgrade",
            "User-Agent": "DeviceScript",
            "Sec-WebSocket-Key": base64Encode(randomBuffer(8).toString("hex")),
            "Sec-WebSocket-Version": "13",
        }

        const headersString = Object.keys(headers)
            .map(key => `${key}: ${headers[key]}`)
            .join("\r\n")

        await socket.send(
            `GET ${
                this.uri.pathname || "/"
            } HTTP/1.1\r\n${headersString}\r\n\r\n`
        )
    }
    async receive(_: any) {
        const data = await this.socket.recv()
        if (data.toString().startsWith("HTTP/1.1 101")) {
            this.state = "OPEN"
            console.log("We are so connected")
            await this.send("hi ??")
            return
        }
        const decodedData = await decodeFrame(data)
        console.log("received message:", decodedData)
    }

    async send(data: string | Buffer) {
        const buffer = await encodeFrame(data)
        await this.socket.send(buffer)
        console.log("sent message:", data)
    }
}
const data = new WebSocket(new URL("ws://127.0.0.1:8080"))
await data.open()
