import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function crc32(buffer) {
  let crc = ~0
  for (let index = 0; index < buffer.length; index += 1) {
    crc ^= buffer[index]
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const name = Buffer.from(type)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(width, height, pixels) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const start = y * (width * 4 + 1)
    raw[start] = 0
    pixels.copy(raw, start + 1, y * width * 4, (y + 1) * width * 4)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function rounded(x, y, left, top, size, radius) {
  const right = left + size
  const bottom = top + size
  if (x < left || y < top || x >= right || y >= bottom) return false
  const dx = x < left + radius ? left + radius - x : x > right - radius ? x - (right - radius) : 0
  const dy = y < top + radius ? top + radius - y : y > bottom - radius ? y - (bottom - radius) : 0
  return dx * dx + dy * dy <= radius * radius
}

function draw(size, maskable) {
  const pixels = Buffer.alloc(size * size * 4)
  const paper = [247, 241, 230, 255]
  const page = [255, 250, 243, 255]
  const ink = [43, 38, 31, 255]
  const margin = [228, 177, 171, 255]
  const pad = maskable ? Math.round(size * 0.14) : Math.round(size * 0.08)
  const pageSize = size - pad * 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4
      const background = maskable || rounded(x, y, 0, 0, size, Math.round(size * 0.18)) ? paper : [0, 0, 0, 0]
      let color = background
      if (rounded(x, y, pad, pad, pageSize, Math.round(size * 0.06))) color = page
      const marginX = pad + Math.round(pageSize * 0.16)
      if (Math.abs(x - marginX) <= Math.max(1, size / 180) && y > pad + 8 && y < pad + pageSize - 8) color = margin
      const dot = Math.round(size * 0.045)
      if (Math.hypot(x - (pad + pageSize * 0.34), y - (pad + pageSize * 0.38)) < dot) color = ink
      if (Math.abs(y - (pad + pageSize * 0.38)) <= Math.max(1, size / 200) && x > pad + pageSize * 0.42 && x < pad + pageSize * 0.78) color = ink
      const ring = Math.hypot(x - (pad + pageSize * 0.34), y - (pad + pageSize * 0.52))
      if (ring > dot * 0.7 && ring < dot * 1.15) color = ink
      if (Math.abs(y - (pad + pageSize * 0.52)) <= Math.max(1, size / 200) && x > pad + pageSize * 0.42 && x < pad + pageSize * 0.72) color = ink
      pixels.set(color, offset)
    }
  }
  return png(size, size, pixels)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', draw(192, false))
writeFileSync('public/icons/icon-512.png', draw(512, false))
writeFileSync('public/icons/icon-maskable-512.png', draw(512, true))
