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
    if (sameProcess(owner.pid, owner.started)) {
      process.kill(owner.pid, 'SIGTERM')
    } else if (sameProcess(owner.child, owner.childStarted)) {
      process.kill(isLinux ? -owner.child : owner.child, 'SIGTERM')
    }
  }
  process.exit(0)
}
if (
  ![
    'dev',
    'build',
    'analyze',
    'typecheck',
    'lint',
    'deploy',
    'vendors',
  ].includes(mode)
) {
  throw new Error(
    'Usage: node scripts/run-next.mjs [dev|build|analyze|typecheck|lint|deploy|vendors|stop] [CLI options]',
  )
}

const isBuild = mode === 'build' || mode === 'analyze'
const bundler = process.env.SHIRO_BUNDLER || (isBuild ? 'webpack' : 'turbopack')
if (!['webpack', 'turbopack'].includes(bundler)) {
  throw new Error('SHIRO_BUNDLER must be webpack or turbopack.')
}
const budget = Number(
  process.env.SHIRO_MEMORY_MB ||
    (isBuild ? 2048 : mode === 'dev' ? 3072 : 1536),
)
const heap = Number(
  process.env.SHIRO_HEAP_MB ||
    (mode === 'dev'
      ? 512
      : isBuild
        ? bundler === 'webpack'
          ? 1408
          : 640
        : 768),
)
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
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => scoped.kill(signal))
    }
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
let scopePeak = 0
let cancelled = false
const stages = []
const scopePath =
  isLinux && process.env.SHIRO_MEMORY_SCOPE
    ? `/sys/fs/cgroup${readFileSync('/proc/self/cgroup', 'utf8').trim().split('::')[1]}`
    : null
function scopeMemory() {
  if (!scopePath) return null
  try {
    const events = Object.fromEntries(
      readFileSync(`${scopePath}/memory.events`, 'utf8')
        .trim()
        .split('\n')
        .map((line) => line.split(' ')),
    )
    const current =
      Number(readFileSync(`${scopePath}/memory.current`, 'utf8')) / 1048576
    const maximum =
      Number(readFileSync(`${scopePath}/memory.peak`, 'utf8')) / 1048576
    scopePeak = Math.max(scopePeak, maximum)
    return { current, oomKills: Number(events.oom_kill || 0) }
  } catch {
    return null
  }
}
const hasCgroup = scopeMemory() !== null
if (process.env.SHIRO_REQUIRE_CGROUP === '1') {
  const limit =
    hasCgroup && readFileSync(`${scopePath}/memory.max`, 'utf8').trim()
  const swap =
    hasCgroup && readFileSync(`${scopePath}/memory.swap.max`, 'utf8').trim()
  if (Number(limit) !== budget * 1048576 || swap !== '0') {
    rmSync(lock, { recursive: true, force: true })
    throw new Error(
      'A matching cgroup memory limit with swap disabled is required.',
    )
  }
}
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
  const stageStarted = performance.now()
  let stageRss = 0
  let stageScope = 0
  const initialOomKills = scopeMemory()?.oomKills || 0
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
        RAYON_NUM_THREADS: '1',
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
  let lastRssSample = 0
  let rss = 0
  const sample = () => {
    if (performance.now() - lastRssSample >= 1000) {
      rss = treeRss(child.pid)
      lastRssSample = performance.now()
    }
    const scoped = scopeMemory()
    peak = Math.max(peak, rss)
    stageRss = Math.max(stageRss, rss)
    stageScope = Math.max(stageScope, scoped?.current || 0)
    const usage = scoped?.current ?? rss
    const limit = scopePath ? budget - 128 : budget
    if (usage > limit && !exceeded) {
      exceeded = true
      console.error(
        `Shiro 编译任务达到 ${Math.ceil(usage)} MiB，正在停止并保留 ${budget - limit} MiB 余量。`,
      )
      stop()
    }
  }
  sample()
  const timer = setInterval(sample, 100)
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
  const wasOomKilled = (scopeMemory()?.oomKills || 0) > initialOomKills
  const result = exceeded || wasOomKilled ? 137 : code
  stages.push({
    command: cli.startsWith(root) ? cli.slice(root.length) : cli,
    durationSeconds: Math.round((performance.now() - stageStarted) / 100) / 10,
    heapMiB: stageHeap,
    sampledPeakRssMiB: stageRss ? Math.ceil(stageRss) : null,
    sampledPeakScopeMiB: Math.ceil(stageScope),
    oomKilled: wasOomKilled,
    code: result,
  })
  return result
}

console.log(
  `Shiro ${mode}: process-tree budget ${budget} MiB, V8 heap ${heap} MiB, one compiler at a time.`,
)
let code = 0
if (mode === 'dev' || mode === 'typecheck' || mode === 'vendors' || isBuild) {
  console.log('Batch 1: prepare styles, syntax grammars and diagram assets.')
  code = await run(resolve(root, 'scripts/prepare-assets.mjs'), [], 384)
  if (code === 0 && !cancelled) {
    code = await run(resolve(root, 'scripts/prepare-excalidraw.mjs'), [], 512)
  }
}
if (isBuild || mode === 'typecheck') {
  console.log('Batch 3: check application types in a separate process.')
  if (code === 0 && !cancelled) {
    code = await run(
      resolve(
        dirname(require.resolve('@typescript/native/package.json')),
        'bin/tsc',
      ),
      ['--noEmit', '--singleThreaded'],
      Math.min(heap, 768),
    )
  }
}
if (mode === 'lint') {
  code = await run(
    resolve(dirname(require.resolve('eslint/package.json')), 'bin/eslint.js'),
    extra,
  )
}
if (mode === 'deploy') code = await run('docker', extra, heap, false)
if (code === 0 && !cancelled && ['dev', 'build', 'analyze'].includes(mode)) {
  if (isBuild) {
    console.log('Batch 4: compile application routes with one compiler thread.')
  }
  const bundlerFlag = `--${bundler}`
  const args =
    mode === 'dev'
      ? ['dev', bundlerFlag, '-p', process.env.WEB_PORT || '2323']
      : ['build', bundlerFlag]
  code = await run(require.resolve('next/dist/bin/next'), [...args, ...extra])
}
if (cancelled && code === 0) code = 130
writeFileSync(
  resolve(runtime, 'last-run.json'),
  JSON.stringify(
    {
      mode,
      nodeVersion: process.version,
      bundler,
      budgetMiB: budget,
      heapMiB: heap,
      enforcement: hasCgroup
        ? 'cgroup'
        : isLinux
          ? 'process-tree-rss'
          : 'v8-heap',
      peakRssMiB: Math.ceil(peak),
      peakScopeMiB: Math.ceil(scopePeak),
      code,
      stages,
    },
    null,
    2,
  ),
)
writeFileSync(
  resolve(runtime, `${mode}-result.json`),
  readFileSync(resolve(runtime, 'last-run.json')),
)
console.log(
  `Shiro ${mode}: process-tree peak ${Math.ceil(peak)} MiB; cgroup peak ${Math.ceil(scopePeak)} MiB; exit ${code}.`,
)
process.exit(code)
