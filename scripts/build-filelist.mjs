import { readdirSync, writeFileSync, statSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const __dirname = dirname(fileURLToPath(import.meta.url))

function scanDirFiles(dir, root) {
  const files = []
  const base = root || dir

  for (const name of readdirSync(dir)) {
    const fullPath = resolve(dir, name)
    const stat = statSync(fullPath)
    if (stat.isFile()) {
      files.push(relative(base, fullPath).replace(/\\/g, '/')) // 保证路径分隔符统一
    } else if (stat.isDirectory()) {
      files.push(...scanDirFiles(fullPath, base))
    }
  }

  return files
}

function scanDir(dir) {
  const entries = {}
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name)
    const stat = statSync(full)
    if (stat.isFile()) {
      entries[name] = { size: stat.size }
    } else if (stat.isDirectory()) {
      entries[name] = scanDir(full)
    }
  }
  return entries
}

const distPath = resolve(__dirname, '../dist')
const list = scanDirFiles(distPath)
const listFilename = 'nodeget-theme-files.json'
list.push(listFilename)
writeFileSync(resolve(distPath, listFilename), JSON.stringify(list, null, 2))