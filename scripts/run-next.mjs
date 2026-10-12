import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const pidPattern = /^\d+$/
const heapOptionPattern = /--max[-_]old[-_]space[-_]size(?:=|\s+)\d+/g

const root = fileURLToPath(new URL('../', import.meta.url))
const web = resolve(root, 'apps/web')
const require = createRequire(resolve(web, 'package.json'))
const mode = process.argv[2] || 'dev'
const extra = process.argv.slice(3)
const runtime = resolve(root, '.runtime')
const lock = resolve(runtime, 'compiler.lock')
const pidFile = resolve(lock, 'owner.json')
const isLinux = process.platform === 'linux'
const alive = (pid) => {
  if (!Number.isInteger(pid) || pid < 2) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const started = (pid) => {
  if (!isLinux || !alive(pid)) return null
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    return stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
  } catch {
    return null
  }
}
const sameProcess = (pid, start) =>
  alive(pid) && (!isLinux || (start && started(pid) === start))

if (mode === 'stop') {
  if (existsSync(pidFile)) {
    const owner = JSON.parse(readFileSync(pidFile, 'utf8'))
    if (sameProcess(owner.pid, owner.started))
      {process.kill(owner.pid, 'SIGTERM')}
    else if (sameProcess(owner.child, owner.childStarted)) {
      process.kill(isLinux ? -owner.child : owner.child, 'SIGTERM')
    }
  }
  process.exit(0)
}
if (
  !['dev', 'build', 'analyze', 'typecheck', 'lint', 'deploy'].includes(mode)
) {
  throw new Error(
    'Usage: node scripts/run-next.mjs [dev|build|analyze|typecheck|lint|deploy|stop] [CLI options]',
  )
}

const isBuild = mode === 'build' || mode === 'analyze'
const budget = Number(
  process.env.SHIRO_MEMORY_MB || (isBuild || mode === 'dev' ? 3072 : 1536),
)
const heap = Number(process.env.SHIRO_HEAP_MB || 768)
if (
  !Number.isFinite(budget) ||
  budget < 256 ||
  !Number.isFinite(heap) ||
  heap < 128 ||
  heap >= budget
) {
  throw new Error(
    'SHIRO_MEMORY_MB must exceed SHIRO_HEAP_MB; minimum budget is 256 MiB.',
  )
}

// A cgroup applies the limit to the whole compiler tree, including native memory.
// Hosts without systemd still use the process-tree RSS monitor below.
if (
  isLinux &&
  !process.env.SHIRO_MEMORY_SCOPE &&
  existsSync('/run/systemd/system')
) {
  const args = [
    '--user',
    '--scope',
    '--quiet',
    '--collect',
    '-p',
    `MemoryMax=${budget}M`,
    '-p',
    'MemorySwapMax=0',
    '-p',
    'CPUQuota=200%',
  ]
  const probe = spawnSync('systemd-run', [...args, '/usr/bin/true'], {
    stdio: 'ignore',
  })
  if (probe.status === 0) {
    const scoped = spawn(
      'systemd-run',
      [
        ...args,
        process.execPath,
        fileURLToPath(import.meta.url),
        mode,
        ...extra,
      ],
      {
        stdio: 'inherit',
        env: { ...process.env, SHIRO_MEMORY_SCOPE: '1' },
      },
    )
    for (const signal of ['SIGINT', 'SIGTERM'])
      {process.on(signal, () => scoped.kill(signal))}
    scoped.on('exit', (code) => process.exit(code ?? 1))
    scoped.on('error', (error) => {
      console.error(error.message)
      process.exit(1)
    })
    await new Promise(() => {})
  }
}

mkdirSync(runtime, { recursive: true })
try {
  mkdirSync(lock)
} catch (error) {
  if (error.code !== 'EEXIST') throw error
  const owner = existsSync(pidFile)
    ? JSON.parse(readFileSync(pidFile, 'utf8'))
    : null
  if (!owner || alive(owner.pid) || (owner.child && alive(owner.child))) {
    console.error(
      'Shiro 已有编译任务运行。先按 Ctrl+C，或运行 node scripts/run-next.mjs stop。',
    )
    process.exit(1)
  }
  rmSync(lock, { recursive: true, force: true })
  mkdirSync(lock)
}
let child
let peak = 0
let cancelled = false
const saveOwner = () =>
  writeFileSync(
    pidFile,
    JSON.stringify({
      pid: process.pid,
      started: started(process.pid),
      child: child?.pid,
      childStarted: started(child?.pid),
      mode,
      budget,
    }),
  )
saveOwner()
const stop = () => {
  cancelled = true
  if (child?.pid) {
    try {
      process.kill(isLinux ? -child.pid : child.pid, 'SIGTERM')
    } catch {}
    const pid = child.pid
    const timer = setTimeout(() => {
      try {
        process.kill(isLinux ? -pid : pid, 'SIGKILL')
      } catch {}
    }, 1500)
    timer.unref()
  }
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop)
process.on('exit', () => rmSync(lock, { recursive: true, force: true }))

function treeRss(pid) {
  if (!isLinux) return 0
  let kib = 0
  const processes = []
  for (const entry of readdirSync('/proc')) {
    if (!pidPattern.test(entry)) continue
    try {
      const raw = readFileSync(`/proc/${entry}/stat`, 'utf8')
      const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ')
      processes.push({
        pid: Number(entry),
        parent: Number(fields[1]),
        group: Number(fields[2]),
        rss: Number(fields[21]) * 4,
      })
    } catch {}
  }
  const descendants = new Set([pid])
  let changed = true
  while (changed) {
    changed = false
    for (const item of processes) {
      if (
        !descendants.has(item.pid) &&
        (item.group === pid || descendants.has(item.parent))
      ) {
        descendants.add(item.pid)
        changed = true
      }
    }
  }
  for (const item of processes) if (descendants.has(item.pid)) kib += item.rss
  return kib / 1024
}

async function run(cli, args, stageHeap = heap, isNode = true) {
  const command = isNode ? process.execPath : cli
  const commandArgs = isNode
    ? [`--max-old-space-size=${stageHeap}`, cli, ...args]
    : args
  child = spawn(
    isLinux ? '/bin/sh' : command,
    isLinux
      ? [
          '-c',
          'ulimit -c 0; exec "$@"',
          'shiro-compiler',
          command,
          ...commandArgs,
        ]
      : commandArgs,
    {
      cwd: mode === 'deploy' ? root : web,
      stdio: 'inherit',
      detached: isLinux,
      env: {
        ...process.env,
        NODE_OPTIONS:
          `${(process.env.NODE_OPTIONS || '').replace(heapOptionPattern, '')} --max-old-space-size=${stageHeap}`.trim(),
        NODE_ENV: mode === 'dev' ? 'development' : 'production',
        NEXT_TELEMETRY_DISABLED: '1',
        SHARP_IGNORE_GLOBAL_LIBVIPS: '1',
        RAYON_NUM_THREADS: isBuild ? '1' : '2',
        UV_THREADPOOL_SIZE: '2',
        GOMAXPROCS: '2',
        GOMEMLIMIT: `${Math.min(stageHeap, 768)}MiB`,
        ...(mode === 'analyze'
          ? { ANALYZE: 'true', BUNDLE_ANALYZE: 'browser' }
          : {}),
      },
    },
  )
  saveOwner()
  let exceeded = false
  const timer = setInterval(() => {
    const rss = treeRss(child.pid)
    peak = Math.max(peak, rss)
    if (rss > budget && !exceeded) {
      exceeded = true
      console.error(
        `Shiro 编译进程树达到 ${Math.ceil(rss)} MiB，超过 ${budget} MiB 预算，正在停止。`,
      )
      stop()
    }
  }, 1000)
  const code = await new Promise((resolveExit) => {
    child.once('exit', (value) => resolveExit(value ?? 1))
    child.once('error', (error) => {
      console.error(error.message)
      resolveExit(1)
    })
  })
  clearInterval(timer)
  child = undefined
  saveOwner()
  return exceeded ? 137 : code
}

console.log(
  `Shiro ${mode}: process-tree budget ${budget} MiB, V8 heap ${heap} MiB, one compiler at a time.`,
)
if (mode === 'dev' || mode === 'typecheck' || isBuild)
  {await import('./prepare-assets.mjs')}
let code = 0
if (isBuild || mode === 'typecheck') {
  code = await run(
    resolve(
      dirname(require.resolve('@typescript/native/package.json')),
      'bin/tsc',
    ),
    ['--noEmit', '--singleThreaded'],
    Math.min(heap, 768),
  )
}
if (mode === 'lint') {
  code = await run(
    resolve(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'),
    extra,
  )
}
if (mode === 'deploy') code = await run('docker', extra, heap, false)
if (code === 0 && !cancelled && ['dev', 'build', 'analyze'].includes(mode)) {
  const bundler =
    process.env.SHIRO_BUNDLER === 'webpack' ? '--webpack' : '--turbopack'
  const args =
    mode === 'dev'
      ? ['dev', bundler, '-p', process.env.WEB_PORT || '2323']
      : ['build', bundler]
  code = await run(require.resolve('next/dist/bin/next'), [...args, ...extra])
}
writeFileSync(
  resolve(runtime, 'last-run.json'),
  JSON.stringify(
    { mode, budgetMiB: budget, peakRssMiB: Math.ceil(peak), code },
    null,
    2,
  ),
)
console.log(
  `Shiro ${mode}: measured process-tree peak ${Math.ceil(peak)} MiB; exit ${code}.`,
)
process.exit(code)
