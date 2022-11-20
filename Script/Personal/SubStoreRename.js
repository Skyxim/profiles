function operator(proxies) {
    // 构建字符集映射
    const regular = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]
    const bold = ["𝐀", "𝐁", "𝐂", "𝐃", "𝐄", "𝐅", "𝐆", "𝐇", "𝐈", "𝐉", "𝐊", "𝐋", "𝐌", "𝐍", "𝐎", "𝐏", "𝐐", "𝐑", "𝐒", "𝐓", "𝐔", "𝐕", "𝐖", "𝐗", "𝐘", "𝐙", "𝐚", "𝐛", "𝐜", "𝐝", "𝐞", "𝐟", "𝐠", "𝐡", "𝐢", "𝐣", "𝐤", "𝐥", "𝐦", "𝐧", "𝐨", "𝐩", "𝐪", "𝐫", "𝐬", "𝐭", "𝐮", "𝐯", "𝐰", "𝐱", "𝐲", "𝐳", "𝟎", "𝟏", "𝟐", "𝟑", "𝟒", "𝟓", "𝟔", "𝟕", "𝟖", "𝟗"]
    let charMap = new Map()
    regular.forEach((value, index) => {
        charMap.set(value, bold[index])
    })

    function fixedNum(num, fill) {
        return (Array(fill).join("0") + num).slice(-fill)
    }

    function mapCharset(oldString) {
        var newString = [];
        for (var char of oldString) {
            if (!charMap.has(char)) {
                newString.push(char)
            } else {
                newString.push(charMap.get(char))
            }
        }

        return newString.join("")
    }

    // 需要的地区 key=>匹配正则，value=>重复次数
    let needRegion = new Map()
    needRegion.set("🇸🇬SG", { reg: /新加坡|SG|狮城|🇸🇬/i, replace: 1 })
    needRegion.set("🇭🇰HK", { reg: /香港|HK|🇭🇰/i, replace: 1 })
    needRegion.set("🇯🇵JP", { reg: /日本|JP|🇯🇵/i, replace: 1 })
    needRegion.set("🇺🇸US", { reg: /美国|US|🇺🇸/i, replace: 1 })
    needRegion.set("🇰🇷KR", { reg: /韩国|KR|🇰🇷/i, replace: 1 })
    needRegion.set("🇨🇳TW", { reg: /台湾|TW|🇨🇳/i, replace: 1 })

    let newProxies = []
    for (const proxy of proxies) {
        let name = proxy.name
        for (const [key, value] of needRegion) {
            let reg = value.reg
            let replaceNum = value.replace
            if (reg.test(name)) {
                let newName = `${key} ${fixedNum(replaceNum++, 2)}`
                value.replace = replaceNum
                needRegion.set(key, value)
                proxy.name = newName
                newProxies.push(proxy)
                break
            }
        }
    }


    newProxies = newProxies.sort((a, b) => {
        return a.name.localeCompare(b.name)
    })

    for (const proxy of newProxies) {
        proxy.name = mapCharset(proxy.name)
    }

    return newProxies
}

