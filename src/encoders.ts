import { randomBuffer } from "@devicescript/crypto"
import { splitLength } from "./util"

export async function encodeFrame(data: string | Buffer) {
    const type = data instanceof Buffer ? 0b00000010 : 0b00000001
    const dataBuffer = data instanceof Buffer ? data : Buffer.from(data)
    const length = dataBuffer.length
    const lengthArray = splitLength(length).slice(0, 4)

    // 1st bit of length is always 1 becausewe have to mask
    let lengthBits = length <= 125 ? [0b10000000 | length] : null

    if (length < 65535 && length > 125) {
        console.log("here")
        // length can be represented in 16 bits, but not in 7.
        lengthBits = [0b11111110, lengthArray[0], lengthArray[1]]
    } else if (length > 65535) {
        // this can never possibly work without erroring anyways
        throw new RangeError("Message too long")
    }
    const maskingKey = randomBuffer(4)
    const buffer = Buffer.from([
        0x80 | type, // 0-7, first bit is always 1 because i am too lazy to fragment messages and the next 3 are for extensions, the last 4 are opcode
        ...lengthBits, // length bits and whether the message is masked, either from 8 to 15, 8 to 23, or 8 to 63
    ])

    // this starts erroring somewhere around 4kb's of data due to "infinite loop"
    // probably a bug in devicescript, reported already on their github
    for (let i = 0; i < dataBuffer.length; i++) {
        dataBuffer[i] ^= maskingKey[i % 4]
    }

    return Buffer.concat(buffer, maskingKey, dataBuffer)
}
let unfinishedFrame: { type: "text" | "buffer"; data: Buffer }
export async function decodeFrame(data: Buffer): Promise<{
    type: "text" | "buffer" | "other"
    data?: string | Buffer
    // biome-ignore lint/suspicious/noConfusingVoidType: <explanation>
} | void> {
    const lastFrame = data.getBit(0)
    const opcode = data[0] & 0b00001111
    const type = opcode === 0b00000001 ? "text" : "buffer"
    const masking = data.getBit(8)
    let payloadOffset = 2
    let length = data[1] & 0b01111111
    if (masking) throw new Error("Servers must not mask their frames.")
    // todo: add handling for all other opcodes
    if (opcode !== 0b00000001 && opcode !== 0b00000010 && opcode !== 0)
        return { type: "other" }
    if (length === 126) {
        length = data.readUInt16BE(2)
        payloadOffset = 4
    } else if (length === 127) {
        length = data.readUInt32BE(6)
        const length2 = data.readUInt32BE(2)
        payloadOffset = 10
        if (length2 !== 0) {
            throw new RangeError("Message too long")
        }
    }
    const payload = data.slice(payloadOffset)
    if (payload.length !== length)
        throw new RangeError(
            "Payload length doesn't match the length sent in the frame."
        )

    if (lastFrame) {
        // this is a continuation frame and the last frame, we can return the data
        if (opcode === 0) {
            const frame = unfinishedFrame
            frame.data = Buffer.concat(frame.data, payload)
            unfinishedFrame = null
            return {
                data:
                    frame.type === "text" ? frame.data.toString() : frame.data,
                type: frame.type,
            }
        }
        // this is a full frame without any fragmentation
        if (opcode === 0b00000001 || opcode === 0b00000010) {
            return {
                data: type === "text" ? payload.toString() : payload,
                type,
            }
        }
    } else {
        // this is a continuation frame and not the last frame, we add it to the data
        if (opcode === 0) {
            unfinishedFrame.data = Buffer.concat(unfinishedFrame.data, payload)
            return
        }
        // this is the first frame of a fragmented message
        if (opcode === 0b00000001 || opcode === 0b00000010) {
            unfinishedFrame = {
                type,
                data: payload,
            }
        }
    }
    return { type: "other" }
}
