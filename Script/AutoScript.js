const $ = API("auto_policy", false)
let config = {
    policies: [],
}

const isLoon = typeof $loon !== "undefined"
const isSurge = typeof $httpClient !== "undefined" && !isLoon

const policies = $.read("policies")
config.httpApi = $.read("api")
config.httpApiKey = $.read("key")
if (policies) {
    config.policies = JSON.parse(policies)
}

// get current decisions
let groups, network, ssid
if (isSurge) {
    groups = Object.keys($surge.selectGroupDetails().groups)
    network = $network
} else if (isLoon) {
    const conf = JSON.parse($config.getConfig())
    groups = conf.all_policy_groups
    ssid = conf.ssid
}

manager()
    .catch((err) => {
        notify.post("自动策略", `出现错误`, err)
        console.log("ERROR: " + err)
    })
    .finally(() => {
        $done({})
    })

async function manager() {
    // no network connection
    let modules = await getModules()
    const v4_ip = network.v4.primaryAddress
    if (!v4_ip) {
        notify.post("自动策略", "当前无网络", "")
        return
    }

    console.log(`网络信息：${JSON.stringify(network)}`)

    let needChangeModules = {}
    let needIgnorePolicy = {}
    for (let policy of config.policies) {
        console.log("判断策略: " + policy.rule);
        if (isCellularRule(policy.rule)) {
            console.log("CELLULAR");
            if (network.wifi.ssid === null) {
                if (isModule(policy.group)) {
                    let module = policy.group.substr("MODULE:".length).trim()
                    if (!needChangeModules[module]) {
                        needChangeModules[module] = { decision: policy.decision, filter: needChangeMoudle(modules, module, policy.decision) }
                    }
                } else {
                    if (!needIgnorePolicy[policy.group]) {
                        needIgnorePolicy[policy.group] = true
                        changePolicy(policy.group, policy.decision)
                    }
                }
            }
            continue
        }

        if (isAddrRule(policy.rule)) {
            console.log("IP");
            let ip = policy.rule.substr(3).trim()
            if (ip.length > 0) {
                if (ip === network.v4.primaryRouter) {
                    if (isModule(policy.group)) {
                        let module = policy.group.substr("MODULE:".length).trim()
                        if (!needChangeModules[module]) {
                            needChangeModules[module] = { decision: policy.decision, filter: needChangeMoudle(modules, module, policy.decision) }
                        }
                    } else {
                        if (!needIgnorePolicy[policy.group]) {
                            needIgnorePolicy[policy.group] = true
                            changePolicy(policy.group, policy.decision)
                        }
                    }
                }
            }
            continue
        }

        console.log("SSID");
        // 其他默认为 SSID
        var re = new RegExp(policy.rule)
        if (re.test(network.wifi.ssid)) {
            if (isModule(policy.group)) {
                let module = policy.group.substr("MODULE:".length).trim()
                if (!needChangeModules[module]) {
                    needChangeModules[module] = { decision: policy.decision, filter: needChangeMoudle(modules, module, policy.decision) }
                }
            } else {
                if (!needIgnorePolicy[policy.group]) {
                    needIgnorePolicy[policy.group] = true
                    changePolicy(policy.group, policy.decision)
                }
            }
        }
    }

    await changeModules(needChangeModules)
}

function isCellularRule(rule) {
    return rule === "CELLULAR"
}

function isAddrRule(rule) {
    return rule.startsWith("IP:")
}

function isModule(group) {
    return group.startsWith("MODULE:")
}

function listify(str, sperator = ",") {
    return str.split(sperator).map((i) => i.trim())
}

function changePolicy(group, decision) {
    if (isSurge) {
        console.log(`Surge 切换 ${group} 的策略为 ${decision}`)
        $surge.setSelectGroupPolicy(group.trim(), decision.trim())
    } else if (isLoon) {
        console.log(`Loon 切换 ${group} 的策略为 ${decision}`)
        $config.setSelectPolicy(group.trim(), decision.trim())
    }
}

function needChangeMoudle(modules, module, isEnable) {
    return modules.available.includes(module) && (modules.enabled.includes(module) !== isEnable)
}

async function getModules() {
    return new Promise(resolve => {
        $httpAPI("GET", "/v1/modules", null, (data) => {
            resolve(data)
        })
    });
}

async function changeModules(body) {
    console.log("change moudle " + JSON.stringify(body))
    let newBody = {}
    for (var i in body) {
        if (body[i].filter) {
            newBody[i] = body[i].decision
        }
    }
    if (Object.keys(newBody).length === 0) {
        return
    }

    $httpAPI("POST", "/v1/modules", newBody, () => $done({}));
}
// prettier-ignore
/*********************************** API *************************************/
function ENV() { const e = "undefined" != typeof $task, t = "undefined" != typeof $loon, s = "undefined" != typeof $httpClient && !t, i = "function" == typeof require && "undefined" != typeof $jsbox; return { isQX: e, isLoon: t, isSurge: s, isNode: "function" == typeof require && !i, isJSBox: i, isRequest: "undefined" != typeof $request, isScriptable: "undefined" != typeof importModule } } function HTTP(e = { baseURL: "" }) { const { isQX: t, isLoon: s, isSurge: i, isScriptable: n, isNode: o } = ENV(), r = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=]*)/; const u = {}; return ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"].forEach(l => u[l.toLowerCase()] = (u => (function (u, l) { l = "string" == typeof l ? { url: l } : l; const h = e.baseURL; h && !r.test(l.url || "") && (l.url = h ? h + l.url : l.url); const a = (l = { ...e, ...l }).timeout, c = { onRequest: () => { }, onResponse: e => e, onTimeout: () => { }, ...l.events }; let f, d; if (c.onRequest(u, l), t) f = $task.fetch({ method: u, ...l }); else if (s || i || o) f = new Promise((e, t) => { (o ? require("request") : $httpClient)[u.toLowerCase()](l, (s, i, n) => { s ? t(s) : e({ statusCode: i.status || i.statusCode, headers: i.headers, body: n }) }) }); else if (n) { const e = new Request(l.url); e.method = u, e.headers = l.headers, e.body = l.body, f = new Promise((t, s) => { e.loadString().then(s => { t({ statusCode: e.response.statusCode, headers: e.response.headers, body: s }) }).catch(e => s(e)) }) } const p = a ? new Promise((e, t) => { d = setTimeout(() => (c.onTimeout(), t(`${u} URL: ${l.url} exceeds the timeout ${a} ms`)), a) }) : null; return (p ? Promise.race([p, f]).then(e => (clearTimeout(d), e)) : f).then(e => c.onResponse(e)) })(l, u))), u } function API(e = "untitled", t = !1) { const { isQX: s, isLoon: i, isSurge: n, isNode: o, isJSBox: r, isScriptable: u } = ENV(); return new class { constructor(e, t) { this.name = e, this.debug = t, this.http = HTTP(), this.env = ENV(), this.node = (() => { if (o) { return { fs: require("fs") } } return null })(), this.initCache(); Promise.prototype.delay = function (e) { return this.then(function (t) { return ((e, t) => new Promise(function (s) { setTimeout(s.bind(null, t), e) }))(e, t) }) } } initCache() { if (s && (this.cache = JSON.parse($prefs.valueForKey(this.name) || "{}")), (i || n) && (this.cache = JSON.parse($persistentStore.read(this.name) || "{}")), o) { let e = "root.json"; this.node.fs.existsSync(e) || this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.root = {}, e = `${this.name}.json`, this.node.fs.existsSync(e) ? this.cache = JSON.parse(this.node.fs.readFileSync(`${this.name}.json`)) : (this.node.fs.writeFileSync(e, JSON.stringify({}), { flag: "wx" }, e => console.log(e)), this.cache = {}) } } persistCache() { const e = JSON.stringify(this.cache, null, 2); s && $prefs.setValueForKey(e, this.name), (i || n) && $persistentStore.write(e, this.name), o && (this.node.fs.writeFileSync(`${this.name}.json`, e, { flag: "w" }, e => console.log(e)), this.node.fs.writeFileSync("root.json", JSON.stringify(this.root, null, 2), { flag: "w" }, e => console.log(e))) } write(e, t) { if (this.log(`SET ${t}`), -1 !== t.indexOf("#")) { if (t = t.substr(1), n || i) return $persistentStore.write(e, t); if (s) return $prefs.setValueForKey(e, t); o && (this.root[t] = e) } else this.cache[t] = e; this.persistCache() } read(e) { return this.log(`READ ${e}`), -1 === e.indexOf("#") ? this.cache[e] : (e = e.substr(1), n || i ? $persistentStore.read(e) : s ? $prefs.valueForKey(e) : o ? this.root[e] : void 0) } delete(e) { if (this.log(`DELETE ${e}`), -1 !== e.indexOf("#")) { if (e = e.substr(1), n || i) return $persistentStore.write(null, e); if (s) return $prefs.removeValueForKey(e); o && delete this.root[e] } else delete this.cache[e]; this.persistCache() } notify(e, t = "", l = "", h = {}) { const a = h["open-url"], c = h["media-url"]; if (s && $notify(e, t, l, h), n && $notification.post(e, t, l + `${c ? "\n多媒体:" + c : ""}`, { url: a }), i) { let s = {}; a && (s.openUrl = a), c && (s.mediaUrl = c), "{}" === JSON.stringify(s) ? $notification.post(e, t, l) : $notification.post(e, t, l, s) } if (o || u) { const s = l + (a ? `\n点击跳转: ${a}` : "") + (c ? `\n多媒体: ${c}` : ""); if (r) { require("push").schedule({ title: e, body: (t ? t + "\n" : "") + s }) } else console.log(`${e}\n${t}\n${s}\n\n`) } } log(e) { this.debug && console.log(`[${this.name}] LOG: ${this.stringify(e)}`) } info(e) { console.log(`[${this.name}] INFO: ${this.stringify(e)}`) } error(e) { console.log(`[${this.name}] ERROR: ${this.stringify(e)}`) } wait(e) { return new Promise(t => setTimeout(t, e)) } done(e = {}) { s || i || n ? $done(e) : o && !r && "undefined" != typeof $context && ($context.headers = e.headers, $context.statusCode = e.statusCode, $context.body = e.body) } stringify(e) { if ("string" == typeof e || e instanceof String) return e; try { return JSON.stringify(e, null, 2) } catch (e) { return "[object Object]" } } }(e, t) }
/*****************************************************************************/
