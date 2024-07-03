import { randomBuffer } from "@devicescript/crypto";

const buffer = randomBuffer(4500);
const maskingKey = randomBuffer(4);

for (let i = 0; i < buffer.length; i++) {
	buffer[i] ^= maskingKey[i % 4];
}
