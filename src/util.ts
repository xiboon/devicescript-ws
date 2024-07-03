// used for splitting big numbers into bytes for buffers.
// works as big-endian
export function splitLength(length: number) {
	const lo = length & 0xffff;
	return [(lo >> 8) & 0xff, lo & 0xff];
}

export function base64Encode(s: string): string {
	// the result/encoded string, the padding string, and the pad count
	const base64chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	let result = "";
	let paddingString = "";
	let padCount = s.length % 3;

	// add a right zero pad to make this string a multiple of 3 characters
	if (padCount > 0) {
		for (; padCount < 3; padCount++) {
			paddingString += "=";
			s += "\0";
		}
	}

	// increment over the length of the string, three characters at a time
	for (padCount = 0; padCount < s.length; padCount += 3) {
		// we add newlines after every 76 output characters, according to the MIME specs
		if (padCount > 0 && ((padCount / 3) * 4) % 76 === 0) {
			result += "\r\n";
		}

		// these three 8-bit (ASCII) characters become one 24-bit number
		const n =
			(s.charCodeAt(padCount) << 16) +
			(s.charCodeAt(padCount + 1) << 8) +
			s.charCodeAt(padCount + 2);

		// this 24-bit number gets separated into four 6-bit numbers
		const numbers = [(n >>> 18) & 63, (n >>> 12) & 63, (n >>> 6) & 63, n & 63];

		// those four 6-bit numbers are used as indices into the base64 character list
		result +=
			base64chars[numbers[0]] +
			base64chars[numbers[1]] +
			base64chars[numbers[2]] +
			base64chars[numbers[3]];
	}
	// add the actual padding string, after removing the zero pad
	return result.slice(0, result.length - paddingString.length) + paddingString;
}
