
const isLoon = typeof $loon !== "undefined";
const isSurge = typeof $httpClient !== "undefined" && !isLoon;
const $ = Cache()

const BASE_URL = "https://www.youtube.com/premium"
let config = {
    region: "CN",
    policy: "YouTube",
    cache: {}
}

let boxConfig = $.read("youtube")
if (boxConfig != "" && typeof boxConfig != "undefined") {
    console.log(boxConfig)
    config = JSON.parse(boxConfig)
    if (config.cache === "undefined") {
        config.cache = {}
    }
}

const needRegion = config.region
// let params = getParams($argument)
let youtubeGroup = config.policy
let otherSubProxies = []

let subPolicyCache = new Map(Object.entries(config.cache))

console.log(subPolicyCache.size)
let preSatisfactionProxies = []

    ; (async () => {
        let subProxies = await getSubPolicy(youtubeGroup)
        let oldSubPolicy = await getNowSelectPolicy(youtubeGroup)
        preSatisfactionProxies.push(oldSubPolicy)
        let nowIndex = 0
        for (var key in subProxies) {
            if (subProxies[key].name === oldSubPolicy) {
                nowIndex = key
            }

            let name = subProxies[key].name
            if (subPolicyCache.has(name) && !preSatisfactionProxies.includes(name)) {

                console.log("cache sub proxy:[" + name + "]")
                preSatisfactionProxies.push(name)
            } else {
                let name = subProxies[key].name
                console.log("other sub proxy:[" + name + "]")
                otherSubProxies.push(name)
            }
        }

        for (const proxy of preSatisfactionProxies) {
            let testResult = await selectProxy(proxy)
            if (testResult === true) {
                handleCache()
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toLocaleUpperCase() + " :" + proxy
                })
                return
            }
        }

        for (const proxy of otherSubProxies) {
            let testResult = await selectProxy(proxy)
            if (testResult === true) {
                handleCache()
                $done({
                    title: "YouTube Selected",
                    content: "当前节点 " + needRegion.toLocaleUpperCase() + " :" + proxy
                })
                return
            }
        }


        setPolicy(youtubeGroup, oldSubPolicy)

        handleCache()
        $done({
            title: "YouTube Selected",
            content: "当前节点：" + oldSubPolicy
        })

    })()

function handleCache() {
    let now = (new Date()).getTime()
    let timeout = 7 * 60 * 60 * 24 * 1000
    let needDelKeys = []
    for (const [key, value] of subPolicyCache) {
        if (!isNeedRegion(value.region) || now - value.timestamp > timeout) {
            needDelKeys.push(key)
        }
    }

    needDelKeys.forEach((key) => {
        subPolicyCache.delete(key)
    })

    config.cache = Object.fromEntries(subPolicyCache.entries())
    $.write("youtube", JSON.stringify(config))
}

async function selectProxy(subProxy) {
    setPolicy(youtubeGroup, subProxy)
    try {
        let region = await Promise.race([test(subProxy), timeout(3000)])
        if (isNeedRegion(region)) {
            subPolicyCache.set(subProxy, { region: needRegion, timestamp: (new Date()).valueOf() })
            return true
        }

        console.log("skip" + subProxy)
    } catch (error) {
        console.log(error)
    }

    return false
}

function test(nodeName) {
    return new Promise((resolve, reject) => {
        let option = {
            url: BASE_URL,
            node: nodeName,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
                'Accept-Language': 'en',
            }
        }

        $httpClient.get(option, function (error, response, data) {
            if (error != null || response.status !== 200) {
                reject('Error')
                return
            }

            let region = getRegion(data)
            console.log(region)
            resolve(region.toUpperCase())
        })
    })
}

function isNeedRegion(region) {
    if (needRegion.startsWith("!")) {
        return needRegion.substring(1, needRegion.length) !== region
    } else {
        return needRegion === region
    }
}

function getRegion(data) {
    let region = "";
    console.log(1)

    if (data.indexOf('www.google.cn') !== -1 && data.indexOf('Premium is not available in your country') !== -1) {
        console.log(2)
        region = "CN";
    } else {
        console.log(3)
        let re = new RegExp('"countryCode":"(.*?)"', "gm");
        let result = re.exec(data);
        if (result != null && result.length === 2) {
            region = result[1];
        } else {
            region = "US";
        }
    }

    return region;
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            reject('Timeout')
        }, delay)
    })
}

function httpAPI(path = "", method = "GET", body = null) {
    return new Promise((resolve) => {
        $httpAPI(method, path, body, (result) => {
            resolve(result);
        });
    });
};

function setPolicy(policy, subProxies) {
    console.log(policy + "->" + subProxies)
    if (isSurge) {
        $surge.setSelectGroupPolicy(policy, subProxies)
    } else if (isLoon) {
        $config.setSelectPolicy(policy, subProxies);
    }
}

function Cache() {
    return {
        read: function (name) {
            if (isSurge || isLoon) {
                return $persistentStore.read(name)
            }
        },
        write: function (name, value) {
            if (isSurge || isLoon) {
                $persistentStore.write(value, name)
            }
        }
    }
}

async function getSubPolicy(policy) {
    if (isSurge) {
        return (await httpAPI("/v1/policy_groups"))[policy];
    } else if (isLoon) {
        return (new Promise((resolve) => {
            $config.getSubPolicys(policy, function (str) {
                resolve(JSON.parse(str))
            })
        }))
    }
}


async function getNowSelectPolicy(policy) {
    if (isSurge) {
        return (await httpAPI("/v1/policy_groups/select?group_name=" + encodeURIComponent(policy) + "")).policy
    } else if (isLoon) {
        return (new Map(Object.entries(JSON.parse($config.getConfig()).policy_select))).get(policy)
    }

}