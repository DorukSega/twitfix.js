const express = require('express');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const { MongoClient } = require("mongodb");
const app = express()
const port = 3000 //80

function orderJson(r) { const o = t => { let e = []; for (var n in t) { let r; r = t[n] instanceof Object ? o(t[n]) : t[n], e.push([n, r]) } return e.sort() }, s = e => { let n = "{"; for (let t = 0; t < e.length; t++) { var o = '"' + e[t][0] + '"'; let r; r = e[t][1] instanceof Array ? ":" + s(e[t][1]) + "," : ':"' + e[t][1] + '",', n += o + r } return n = n.substring(0, n.length - 1), n + "}" }; return JSON.parse(s(o(r))) };

const pathregex = new RegExp(/\w{1,15}\/(status|statuses)\/\d{2,20}/g);
var generate_embed_user_agents = ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)", "test"];
var config, twitter_api, link_cache, db;

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
    const client = new MongoClient(config.config.database);
    db = client.db('TwitFix')
}



app.get('/latest/', (req, res) => { //Try to return the latest video
    //do this after mongdb
    res.send('Hello World!')

})

app.get('/', (req, res) => { //If the useragent is discord, return the embed, if not, redirect to configured repo directly
    const user_agent = req.headers["user-agent"]
    if (generate_embed_user_agents.includes(user_agent)) {
        res.send("TwitFix is an attempt to fix twitter video embeds in discord! created by Robin Universe :)\n\n💖\n\nClick me to be redirected to the repo!")
    } else {
        res.redirect(301, config.config.repo);
    }
})

app.post('/oembed.json', (req, res) => { //oEmbed endpoint
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
app.use('/:path', async (req, res, next) => {
    const user_agent = req.headers["user-agent"];
    const url = req.originalUrl.substring(1).match(pathregex)[0];
    const fullURL = req.protocol + '://' + req.get('host') + req.originalUrl;

    if (url.startsWith("https://d.fx")) {
        if (generate_embed_user_agents.includes(user_agent)) {
            console.log(" ➤ [ D ] d.fx link shown to discord user-agent!");
            if (link_cache_system.endsWith(".mp4") && !fullURL.includes("?")) {
                res.send(dl(url));
            } else {
                res.send("To use a direct MP4 link in discord, remove anything past '?' and put '.mp4' at the end")
            }
        }
        else {
            print(" ➤ [ R ] Redirect to MP4 using d.fxtwitter.com")
            req.redirect(dir(url));
        }
    } else if (url.endsWith(".mp4")) {
        if (!fullURL.includes("?")) {
            res.send(dl(url))
        } else {
            res.send("To use a direct MP4 link in discord, remove anything past '?' and put '.mp4' at the end")
        }
    }

    next()
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
function dl(url) {
    console.log(' ➤ [[ !!! TRYING TO DOWNLOAD FILE !!! ]] Downloading file from ' + url)
    const match = url.match(pathregex)[0];
    var twitter_url;
    if (!!match) {
        twitter_url = "https://twitter.com/" + match;
    }

    const m4link = direct_video_link(twitter_url)
    //continue here
}

function direct_video_link(video_link) {// Just get a redirect to a MP4 link from any tweet link
    const cached_vnf = get_vnf_from_link_cache(video_link);
    if (!cached_vnf) {
        //finish
        const vnf = link_to_vnf(video_link)
        add_vnf_to_link_cache(video_link, vnf)
        return vnf['url']
        console.log(" ➤ [ D ] Redirecting to direct URL: " + vnf['url'])
    } else {
        return cached_vnf["url"];
        console.log(" ➤ [ D ] Redirecting to direct URL: " + vnf['url'])
    }

}
function get_vnf_from_link_cache(video_link) {
    if (link_cache_system == "db") {
        //mondodb
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

async function link_to_vnf_from_api(video_link) {
    console.log(" ➤ [ + ] Attempting to download tweet info from Twitter API")
    const twid = video_link.match(/(?!\/)\d+/g)[0];
    const tweet = await twitter_api.v1.singleTweet(twid);
    if (tweet.extended_entities.media[0].video_info.variants != undefined) {
        const vars = tweet.extended_entities.media[0].video_info.variants;
        var biggestBitrate = -1;
        var hqVideoLink, text, thumb;
        thumb = tweet.extended_entities.media[0].media_url;
        //console.log(thumb);
        vars.forEach(el => {
            if (el.bitrate != undefined) {
                if (el.bitrate > biggestBitrate) {
                    biggestBitrate = el.bitrate;
                    hqVideoLink = el.url;
                }
            }
        });
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
})
const message = text => text;
// render_template('default.html', message=text, color=config['config']['color'], appname=config['config']['appname'], repo=config['config']['repo'], url=config['config']['url'])
