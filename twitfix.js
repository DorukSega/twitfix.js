const fs = require('fs'),
    nunjucks = require('nunjucks'),
    path = require('path')
const { TwitterApi } = require('twitter-api-v2');
const { MongoClient } = require("mongodb");
const app = require('fastify')({ logger: true })

const { request } = require("undici");

app.register(require("point-of-view"), {
    engine: {
        nunjucks: nunjucks
    }
});

const port = 3000 //80

const printc = text => console.log("\x1b[35;1m" + text + "\x1b[0m");
function orderJson(r) { const o = t => { let e = []; for (var n in t) { let r; r = t[n] instanceof Object ? o(t[n]) : t[n], e.push([n, r]) } return e.sort() }, s = e => { let n = "{"; for (let t = 0; t < e.length; t++) { var o = '"' + e[t][0] + '"'; let r; r = e[t][1] instanceof Array ? ":" + s(e[t][1]) + "," : ':"' + e[t][1] + '",', n += o + r } return n = n.substring(0, n.length - 1), n + "}" }; return JSON.parse(s(o(r))) };

const pathregex = new RegExp(/\w{1,15}\/(status|statuses)\/\d{2,20}/g);
var generate_embed_user_agents = ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)", "test"];
var config, twitter_api, link_cache, db, collection, vnf;

// Read config from config.json. If it does not exist, create new.
if (!fs.existsSync("./config.json")) {
    const default_config = { "config": { "link_cache": "json", "database": "[url to mongo database goes here]", "method": "youtube-dl", "color": "#43B581", "appname": "TwitFix", "repo": "https://github.com/robinuniverse/twitfix", "url": "https://fxtwitter.com" }, "api": { "api_key": "[api_key goes here]", "api_secret": "[api_secret goes here]", "access_token": "[access_token goes here]", "access_secret": "[access_secret goes here]" } }
    fs.writeFileSync('./config.json', JSON.stringify(orderJson(default_config), null, 4));
    config = default_config;
}
else {
    config = JSON.parse(fs.readFileSync('./config.json'));
}
const link_cache_system = config.config.link_cache;
// If method is set to API or Hybrid, attempt to auth with the Twitter API
if (config.config.method == "api" || config.config.method == "hybrid") {
    twitter_api = new TwitterApi({
        appKey: config.api.api_key,
        appSecret: config.api.api_secret,
        accessToken: config.api.access_token,
        accessSecret: config.api.access_secret,
    });
}


async function mongoConnect() { //connects to mongoDB
    const client = new MongoClient(config.config.database);
    await client.connect();
    db = client.db('TwitFix')
    collection = db.collection('linkCache');

}

if (link_cache_system == "json") {
    if (!fs.existsSync("./links.json")) {
        link_cache = {};
        fs.writeFileSync('./links.json', JSON.stringify(link_cache));
    }
    else {
        link_cache = JSON.parse(fs.readFileSync('./links.json'));
    }
}
else if (link_cache_system == "db") {
    mongoConnect(); //connects to mongodb
}


app.get('/latest/', async (req, res) => { //Try to return the latest video
    vnf = await collection.findOne({}, { sort: { '_id': -1 } });
    const desc = vnf['description'].replace(/ http.*t\.co\S+/, '');
    const urlUser = encodeURI(vnf['uploader'])
    const urlDesc = encodeURI(desc)
    const urlLink = encodeURI(vnf['url'])
    printc(" ➤ [ ✔ ] Latest video page loaded: " + vnf['tweet']);
    res.view('./templates/inline.html', { vidlink: vnf['url'], vidurl: vnf['url'], desc: desc, pic: vnf['thumbnail'], user: vnf['uploader'], video_link: vnf['url'], color: config['config']['color'], appname: config['config']['appname'], repo: config['config']['repo'], url: config['config']['url'], urlDesc: urlDesc, urlUser: urlUser, urlLink: urlLink, tweet: vnf['tweet'] });
})

app.get('/', (req, res) => { //If the useragent is discord, return the embed, if not, redirect to configured repo directly
    const user_agent = req.headers["user-agent"]
    if (generate_embed_user_agents.includes(user_agent)) {
        res.send(message("TwitFix is an attempt to fix twitter video embeds in discord! created by Robin Universe :)\n\n💖\n\nClick me to be redirected to the repo!"))
    } else {
        res.redirect(301, config.config.repo);
    }
})

app.get('/oembed.json', (req, res) => { //oEmbed endpoint
    res.send({
        "type": "video",
        "version": "1.0",
        "provider_name": "TwitFix",
        "provider_url": "https://github.com/robinuniverse/twitfix",
        "title": req.query["desc"],
        "author_name": req.query["user"],
        "author_url": req.query["link"]
    })
})

//twitfix function
app.get('/twitfix/*', async (req, res) => { //change to /*
    const user_agent = req.headers["user-agent"];
    const subPath = req.params["*"];
    const match = req.params["*"].search(pathregex);
    //const url = req.params["*"].match(pathregex)[0];
    const fullURL = req.protocol + '://' + req.hostname + req.url;
    //printc(url + "\n" + fullURL);

    if (fullURL.startsWith("https://d.fx")) {
        if (generate_embed_user_agents.includes(user_agent)) {
            printc(" ➤ [ D ] d.fx link shown to discord user-agent!");
            if (req.url.endsWith(".mp4") && !fullURL.includes("?")) {
                res.send(dl(subPath));
            } else {
                res.send(message("To use a direct MP4 link in discord, remove anything past '?' and put '.mp4' at the end"));
            }
        }
        else {
            printc(" ➤ [ R ] Redirect to MP4 using d.fxtwitter.com")
            req.redirect(dir(subPath));
        }
    } else if (subPath.endsWith(".mp4")) {
        if (!fullURL.includes("?")) {
            res.send(dl(subPath))
        } else {
            res.send(message("To use a direct MP4 link in discord, remove anything past '?' and put '.mp4' at the end"))
        }
    }
    if (match != undefined) {
        var twitter_url = subPath;

        if (match === 0)
            twitter_url = "https://twitter.com/" + subPath;

        if (generate_embed_user_agents.includes(user_agent))
            res.send(embed_video(twitter_url));
        else {
            printc(" ➤ [ R ] Redirect to " + twitter_url)
            req.redirect(301, twitter_url)
        }
    } else {
        res.send(message("This doesn't appear to be a twitter URL"));
    }

})
app.get('/other/*', async (req, res) => { // Show all info that Youtube-DL can get about a video as a json
    //console.log(req.params["*"])
    const otherurl = req.params["*"].replace(":/", "://");
    printc(" ➤ [ OTHER ]  Other URL embed attempted: " + otherurl)
    return embed_video(otherurl);
})

app.get('/info/*', async (req, res) => { // Show all info that Youtube-DL can get about a video as a json
    const infourl = req.params["*"].replace(":/", "://");
    printc(" ➤ [ INFO ]  Info URL embed attempted: " + infourl)
    //with youtube_dl.YoutubeDL({'outtmpl': '%(id)s.%(ext)s'}) as ydl: 
    //    result = ydl.extract_info(infourl, download=False)

    //return result
})

app.get('/dl/*', async (req, res) => { // Show all info that Youtube-DL can get about a video as a json
    const response = await dl(req.params["*"]);
    res.type(response.type);
    res.send(response.file);
})
async function dl(url) {
    printc(' ➤ [[ !!! TRYING TO DOWNLOAD FILE !!! ]] Downloading file from ' + url)
    const match = url.search(pathregex)
    var twitter_url;
    if (match != undefined)
        if (match === 0)
            twitter_url = "https://twitter.com/" + match;

    const m4link = direct_video_link(twitter_url);
    var filename = url.split("/")[url.split("/").length - 1].split('.mp4')[0] + '.mp4';
    const PATH = path.join(__dirname, "./static/" + filename);

    if (fs.statSync(PATH).isFile()) {
        printc(" ➤ [[ FILE EXISTS ]]");
    } else {
        printc(" ➤ [[ FILE DOES NOT EXIST, DOWNLOADING... ]]")
        const {
            statusCode,
            headers,
            trailers,
            mp4file //body?
        } = await request(mp4link);
        await fs.writeFile(PATH, mp4file, { encoding: 'utf8', flag: "w" }, callback);
    }
    printc(' ➤ [[ PRESENTING FILE: ' + filename + ', URL: https://fxtwitter.com/static/' + filename + ' ]]')

    const buffer = await fs.readFileSync(PATH)
    const r = {
        file: buffer,
        type: "video/mp4"
    }
    return r; //dont know what to do here, we need to send a file, make sure to check other ends

}

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})



function direct_video_link(video_link) {// Just get a redirect to a MP4 link from any tweet link
    const cached_vnf = get_vnf_from_link_cache(video_link);
    if (!cached_vnf) {
        try {
            const vnf = link_to_vnf(video_link)
            add_vnf_to_link_cache(video_link, vnf)
            return vnf['url']
            printc(" ➤ [ D ] Redirecting to direct URL: " + vnf['url'])
        } catch (e) {
            printc(e)
            return message("Failed to scan your link!")
        }

    } else {
        return cached_vnf["url"];
        printc(" ➤ [ D ] Redirecting to direct URL: " + vnf['url'])
    }

}
function link_to_vnf(video_link) {// Return a VideoInfo object or die trying
    if (config.config.method == "hybrid") {
        try {
            return link_to_vnf_from_api(video_link)
        } catch (e) {
            console.log(" ➤ [ !!! ] API Failed")
            console.log(e)
            return link_to_vnf_from_youtubedl(video_link)
        }
    } else if (config.config.method == "api") {
        try {
            return link_to_vnf_from_api(video_link)
        } catch (e) {
            console.log(" ➤ [ X ] API Failed")
            console.log(e)
            return null;
        }
    } else if (config.config.method == "youtube-dl") {
        try {
            return link_to_vnf_from_youtubedl(video_link)
        } catch (e) {
            console.log(" ➤ [ X ] Youtube-DL Failed")
            console.log(e)
            return null;
        }
    } else {
        console.log("Please set the method key in your config file to 'api' 'youtube-dl' or 'hybrid'")
        return null;
    }
}
function get_vnf_from_link_cache(video_link) {
    if (link_cache_system == "db") {
        vnf = collection.findOne({ 'tweet': video_link })
        if (vnf != undefined) {
            printc(" ➤ [ ✔ ] Link located in DB cache")
            return vnf
        } else {
            printc(" ➤ [ X ] Link not in DB cache")
            return null
        }
    } else if (link_cache_system == "json") {
        if (link_cache.includes(video_link)) {
            console.log("Link located in json cache");
            return link_cache[video_link];
        } else {
            console.log(" ➤ [ X ] Link not in json cache");
            return null;
        }
    }
}


async function link_to_vnf_from_api(video_link) {
    printc(" ➤ [ + ] Attempting to download tweet info from Twitter API");
    const twid = video_link.match(/(?!\/)\d+/g)[0];
    const tweet = await twitter_api.v1.singleTweet(twid);
    if (tweet.extended_entities.media[0].video_info.variants != undefined) {
        const vars = tweet.extended_entities.media[0].video_info.variants;
        var biggestBitrate = -1;
        var hqVideoLink, text, thumb;
        thumb = tweet.extended_entities.media[0].media_url;
        vars.forEach(el => {
            if (el.bitrate != undefined) {
                if (el.bitrate > biggestBitrate) {
                    biggestBitrate = el.bitrate;
                    hqVideoLink = el.url;
                }
            }
        }); //add more methods?
        if (tweet.full_text.length > 200) {
            text = textwrap.shorten(tweet['full_text'], width = 200, placeholder = "...")
        }
        else {
            text = tweet.full_text
        }
        return video_info(hqVideoLink, video_link, text, thumb, tweet.user.name);
    }
}
const video_info = (url, tweet = "", desc = "", thumb = "", uploader = "") => ({// Return a dict of video info with default values
    "tweet": tweet,
    "url": url,
    "description": desc,
    "thumbnail": thumb,
    "uploader": uploader
});

const message = text => nunjucks.render('./templates/default.html', { message: text, color: config.config.color, appname: config.config.appname, repo: config.config.repo, url: config.config.url });
