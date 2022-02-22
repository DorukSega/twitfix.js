const fs = require('fs'),
    nunjucks = require('nunjucks'),
    path = require('path'),
    app = require('fastify')({ logger: false })
const { TwitterApi } = require('twitter-api-v2');
const { MongoClient } = require("mongodb");
const { request } = require("undici");
//var port = 8080 //80

const start = async () => {
    try {
        const PORT = process.env.port || 8080;
        await app.listen(PORT, '0.0.0.0', () => console.log('SERVER LISTENING AT PORT : ' + PORT))
    } catch (err) {
        app.log.error(err)
        process.exit(1)
    }
}

start();

const printc = text => console.log("\x1b[35;1m" + text + "\x1b[0m");

function orderJson(r) { const o = t => { let e = []; for (var n in t) { let r; r = t[n] instanceof Object ? o(t[n]) : t[n], e.push([n, r]) } return e.sort() }, s = e => { let n = "{"; for (let t = 0; t < e.length; t++) { var o = '"' + e[t][0] + '"'; let r; r = e[t][1] instanceof Array ? ":" + s(e[t][1]) + "," : ':"' + e[t][1] + '",', n += o + r } return n = n.substring(0, n.length - 1), n + "}" }; return JSON.parse(s(o(r))) };

const pathregex = new RegExp(/\w{1,15}\/(status|statuses)\/\d{2,20}/g);

var generate_embed_user_agents = ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)", "test"];

var cfg, twitterApi, linkCache, db, collection;

// Read config from config.json. If it does not exist, create new.
if (!fs.existsSync("./config.json")) {
    const default_config = { "config": { "link_cache": "json", "database": "[url to mongo database goes here]", "method": "youtube-dl", "color": "#43B581", "appname": "TwitFix", "repo": "https://github.com/robinuniverse/twitfix", "url": "https://fxtwitter.com" }, "api": { "api_key": "[api_key goes here]", "api_secret": "[api_secret goes here]", "access_token": "[access_token goes here]", "access_secret": "[access_secret goes here]" } }
    fs.writeFileSync('./config.json', JSON.stringify(orderJson(default_config), null, 4));
    cfg = default_config;
}
else {
    cfg = JSON.parse(fs.readFileSync('./config.json'));
}
const linkCacheSystem = cfg.config.link_cache;

// If method is set to API or Hybrid, attempt to auth with the Twitter API
if (cfg.config.method == "api" || cfg.config.method == "hybrid") {
    twitterApi = new TwitterApi({
        appKey: cfg.api.api_key,
        appSecret: cfg.api.api_secret,
        accessToken: cfg.api.access_token,
        accessSecret: cfg.api.access_secret,
    });
}

async function mongoConnect() { //connects to mongoDB
    const client = new MongoClient(cfg.config.database);
    await client.connect();
    db = client.db('TwitFix')
    collection = db.collection('linkCache');
}

if (linkCacheSystem == "json") {
    if (!fs.existsSync("./links.json")) {
        linkCache = {};
        fs.writeFileSync('./links.json', JSON.stringify(linkCache));
    }
    else {
        linkCache = JSON.parse(fs.readFileSync('./links.json'));
    }
} else if (linkCacheSystem == "db") {
    // mongoConnect(); //connects to mongodb
}

async function linkToVnfFromApi(tweetLink) {
    printc(" ➤ [ + ] Attempting to download tweet info from Twitter API");
    const twid = tweetLink.match(/(?!\/)\d+/g)[0];
    const tweet = await twitterApi.v1.singleTweet(twid);
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
            text = tweet.full_text.slice(0, 200).concat('...');
        }
        else {
            text = tweet.full_text
        }
        return {
            "tweet": hqVideoLink,
            "url": tweetLink,
            "description": text,
            "thumbnail": thumb,
            "uploader": tweet.user.name
        }
    }
}

function embed(videoLink, vnf) {
    printc(" ➤ [ E ] Embedding " + vnf['url'])
    const desc = vnf['description'],
        urlUser = encodeURI(vnf['uploader']),
        urlDesc = encodeURI(desc),
        urlLink = encodeURI(videoLink)
    return nunjucks.render(
        './templates/index.html', {
        vidlink: vnf['url'],
        vidurl: vnf['url'],
        desc: desc,
        pic: vnf['thumbnail'],
        user: vnf['uploader'],
        color: cfg.config.color,
        appname: cfg.config.appname,
        repo: cfg.config.repo,
        url: cfg.config.url,
        urlDesc: urlDesc,
        urlUser: urlUser,
        urlLink: urlLink
    })
}

const message = text => nunjucks.render('./templates/default.html', { message: text, color: cfg.config.color, appname: cfg.config.appname, repo: cfg.config.repo, url: cfg.config.url });


app.get('/', (req, res) => { //If the useragent is discord, return the embed, if not, redirect to configured repo directly
    const user_agent = req.headers["user-agent"]
    if (generate_embed_user_agents.includes(user_agent)) {
        res.type('text/html');
        res.send(message("TwitFix is an attempt to fix twitter video embeds in discord! created by Robin Universe :)\n\n💖\n\nClick me to be redirected to the repo!"))
    } else {
        res.redirect(301, cfg.config.repo);
    }
})

app.get("/*", async (req, res) => {

    const userAgent = req.headers["user-agent"],
        url = req.params["*"],
        match = req.params["*"].search(pathregex);
    var fullUrl = "";

    if (match != undefined) {

        if (url.includes("twitter.com")) {
            fullURL = "https://" + req.params["*"];
        } else {
            fullURL = "https://www.twitter.com/" + req.params["*"];
        }
        printc(fullURL);
        if (url.endsWith(".mp4")) {
            fullUrl = fullUrl.replace(".mp4", "");
            res.type('video/mp4')
            const fileLink = await linkToVnfFromApi(fullURL),
                { body } = await request(fileLink["tweet"])
            res.send(body);
        } else {
            res.type('text/html')
            res.send(embed(fullURL, await linkToVnfFromApi(fullURL)))
        }

    } else {
        res.type('text/html');
        res.send(message("This doesn't appear to be a twitter URL"));
    }
})


app.get('/latest/', async (req, res) => { //Try to return the latest video
    vnf = await collection.findOne({}, { sort: { '_id': -1 } });
    const desc = vnf['description'].replace(/ http.*t\.co\S+/, ''),
        urlUser = encodeURI(vnf['uploader']),
        urlDesc = encodeURI(desc),
        urlLink = encodeURI(vnf['url'])

    printc(" ➤ [ ✔ ] Latest video page loaded: " + vnf['tweet']);
    res.type('text/html')
    res.send(nunjucks.render('./templates/inline.html', {
        vidlink: vnf['url'],
        vidurl: vnf['url'],
        desc: desc, pic: vnf['thumbnail'],
        user: vnf['uploader'],
        video_link: vnf['url'],
        color: cfg.config.color,
        appname: cfg.config.appname,
        repo: cfg.config.repo,
        url: cfg.config.url,
        urlDesc: urlDesc,
        urlUser: urlUser,
        urlLink: urlLink,
        tweet: vnf['tweet']
    }));
})

app.get('/oembed.json', (req, res) => { //oEmbed endpoint
    res.type('application/json+oembed')
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

