import { spawn } from 'node:child_process'

const wechatDir = new URL('./wechat-download-api/', import.meta.url)

const steps = [
  ['docker', ['compose', 'up', '-d'], { cwd: wechatDir }],
  ['npm', ['run', 'x:fetch']],
  ['npm', ['run', 'opps:fetch']],
  ['npm', ['run', process.argv.includes('--commit') ? 'report:commit' : 'report:preview']],
  ['npm', ['run', 'asset:generate']],
]

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio || 'inherit', cwd: options.cwd })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited ${code}`))
    })
  })
}

async function dockerIsReady() {
  try {
    await run('docker', ['info'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function ensureDocker() {
  if (await dockerIsReady()) return
  if (process.platform === 'darwin') {
    console.log('Docker daemon is not ready. Opening Docker Desktop...')
    await run('open', ['-a', 'Docker'])
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await dockerIsReady()) return
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  throw new Error('Docker daemon is not ready. Start Docker Desktop and retry.')
}

await ensureDocker()

for (const [command, args, options] of steps) {
  await run(command, args, options)
}
