import express from "express"
import { normalize } from "node:path"

const port = Number(process.env.PORT) || 3000
const token = process.env.TOKEN
const defaultLimit = 1000

if (!token) fatal("$TOKEN is empty")

function fatal(s: string) {
  throw "\x1b[1;31mfatal:\x1b[0m " + s
}

const store = { meta: {} }

function match(path: string) {
  return Object.keys(store)
    .sort((a, b) => b.length - a.length)
    .find(key => path.startsWith(key))
}

function canon(path: string) {
  return normalize(path + "/")
}

const meta = express()
  .get("/n", (_, res) => {
    res.json(
      Object.keys(store)
        .filter(e => e != "meta")
        .map(i => store[i].length)
        .reduce((a, e) => a + e, 0),
    )
  })
  .use((req, res, next) => {
    if (req.query.token == token) next()
    else res.status(403).end()
  })
  .get("/dump", (_, res) => {
    res.json(store)
  })
  .post("/new/:path(*)", (req, res) => {
    const path = canon(req.params.path)
    if (path in store) return res.status(409).end()

    const i = req.query.i
    if (!i) return res.status(400).end()

    store.meta[path] = { i }
    store[path] = []
    res.status(201).end()
  })
  .all("*", (_, res) => res.status(404).end())

const app = express()
  .use(express.text({ type: "application/json" }))
  .use(express.static("public"))
  .use("/meta", meta)
  .get("/:path(*)", (req, res) => {
    const path = canon(req.params.path)
    const key = match(path)
    if (!key) return res.status(404).end()

    const limit = Number(req.query.n) || defaultLimit
    const data = store[key].slice(0, limit)

    if (path == key) return res.json(data)

    const keys = path.slice(key.length, -1).split("/")
    res.json(data.map(([t, x]) => [t, keys.reduce((a, i) => a[i], x)]))
  })
  .post("/:path(*)", (req, res) => {
    const path = canon(req.params.path)
    if (!(path in store)) return res.status(404).end()

    if (req.query.i != store.meta[path].i) return res.status(403).end()

    let body: any
    try {
      body = JSON.parse(req.body)
    } catch {
      return res.status(400).end()
    }

    const row = [Date.now(), body]
    store[path].unshift(row)
    res.status(201).json(row)

    console.log("new:", path, row)
  })

app.listen(port)
