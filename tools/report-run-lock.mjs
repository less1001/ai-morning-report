import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const [command, slot, value] = process.argv.slice(2)
const lockDir = path.join(os.homedir(), '.codex', 'automations', 'ai', 'locks')

function lockPath(reportSlot) {
  const safeSlot = reportSlot.replace(/[^0-9A-Za-z]+/g, '-').replace(/^-|-$/g, '')
  return path.join(lockDir, `${safeSlot}.json`)
}

async function readLock(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'))
  } catch {
    return null
  }
}

async function acquire(reportSlot) {
  await fs.mkdir(lockDir, { recursive: true })
  const filePath = lockPath(reportSlot)
  const record = { slot: reportSlot, status: 'in_progress', acquired_at: new Date().toISOString() }
  try {
    const handle = await fs.open(filePath, 'wx')
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`)
    await handle.close()
    console.log(JSON.stringify({ result: 'acquired', ...record }))
    return
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  const existing = await readLock(filePath)
  console.log(JSON.stringify({ result: existing?.status === 'sent' ? 'already_sent' : 'in_progress', ...existing }))
}

async function update(reportSlot, status, extra = {}) {
  await fs.mkdir(lockDir, { recursive: true })
  const filePath = lockPath(reportSlot)
  const existing = await readLock(filePath)
  await fs.writeFile(filePath, `${JSON.stringify({
    slot: reportSlot,
    acquired_at: existing?.acquired_at || new Date().toISOString(),
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  }, null, 2)}\n`)
  console.log(JSON.stringify({ result: status, slot: reportSlot, ...extra }))
}

async function release(reportSlot) {
  await fs.rm(lockPath(reportSlot), { force: true })
  console.log(JSON.stringify({ result: 'released', slot: reportSlot }))
}

if (!slot || !['acquire', 'sent', 'release'].includes(command)) {
  throw new Error('Usage: node tools/report-run-lock.mjs acquire|sent|release "YYYY-MM-DD 07:00 BJT" [message-id]')
}

if (command === 'acquire') await acquire(slot)
if (command === 'sent') await update(slot, 'sent', { message_id: value || '' })
if (command === 'release') await release(slot)
