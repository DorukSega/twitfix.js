const express = require('express');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const { MongoClient } = require("mongodb");
const app = express()
const port = 3000

function orderJson(r){const o=t=>{let e=[];for(var n in t){let r;r=t[n]instanceof Object?o(t[n]):t[n],e.push([n,r])}return e.sort()},s=e=>{let n="{";for(let t=0;t<e.length;t++){var o='"'+e[t][0]+'"';let r;r=e[t][1]instanceof Array?":"+s(e[t][1])+",":':"'+e[t][1]+'",',n+=o+r}return n=n.substring(0,n.length-1),n+"}"};return JSON.parse(s(o(r)))};

const pathregex = new RegExp(/\w{1,15}\/(status|statuses)\/\d{2,20}/g);
var generate_embed_user_agents = ["Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:38.0) Gecko/20100101 Firefox/38.0", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)", "TelegramBot (like TwitterBot)", "Mozilla/5.0 (compatible; January/1.0; +https://gitlab.insrt.uk/revolt/january)", "test"];
var config, twitter_api, link_cache, db;

// Read config from config.json. If it does not exist, create new.
if (!fs.existsSync("./config.json")) {
    const default_config = {"config":{"link_cache":"json","database":"[url to mongo database goes here]","method":"youtube-dl", "color":"#43B581", "appname": "TwitFix", "repo": "https://github.com/robinuniverse/twitfix", "url": "https://fxtwitter.com"},"api":{"api_key":"[api_key goes here]","api_secret":"[api_secret goes here]","access_token":"[access_token goes here]","access_secret":"[access_secret goes here]"}}
    fs.writeFileSync('./config.json', JSON.stringify(orderJson(default_config), null,4));
    config=default_config;
}
else{
    config= JSON.parse(fs.readFileSync('./config.json'));
}

// If method is set to API or Hybrid, attempt to auth with the Twitter API
if (config.config.method=="api"||config.config.method=="hybrid"){
    twitter_api = new TwitterApi({
        appKey: config.api.api_key,
        appSecret: config.api.api_secret,
        accessToken: config.api.access_token,
        accessSecret: config.api.access_secret,
    });
}


if (config.config.link_cache == "json"){
    if (!fs.existsSync("./links.json")) {
        link_cache={};
        fs.writeFileSync('./links.json', JSON.stringify(link_cache));
    }
    else{
        link_cache= JSON.parse(fs.readFileSync('./links.json'));
    }
}
else if (config.config.link_cache == "db") {
    const client = new MongoClient(config.config.database);
    db = client.db('TwitFix')
}
    


app.get('/latest/', (req, res) => { //Try to return the latest video
    //do this after mongdb
    res.send('Hello World!')

})

app.get('/', (req, res) => { //If the useragent is discord, return the embed, if not, redirect to configured repo directly
    const user_agent=req.headers["user-agent"]
    if(generate_embed_user_agents.includes(user_agent)){
        res.send("TwitFix is an attempt to fix twitter video embeds in discord! created by Robin Universe :)\n\n💖\n\nClick me to be redirected to the repo!")
    }else{
        res.redirect(301,config.config.repo);
    }
})

app.post('/oembed.json', (req, res) => { //oEmbed endpoint
    res.send({
            "type":"video",
            "version":"1.0",
            "provider_name":"TwitFix",
            "provider_url":"https://github.com/robinuniverse/twitfix",
            "title":req.query["desc"],
            "author_name":req.query["user"],
            "author_url":req.query["link"]
        })
})
app.use('/:path', (req, res,next) => {
    const user_agent=req.headers["user-agent"];
    
    
    if (req.url.startsWith("/d.fx")){
        if (generate_embed_user_agents.includes(user_agent)){
            console.log ( " ➤ [ D ] d.fx link shown to discord user-agent!");
            if (req.url.endsWith(".mp4")){
                res.send()
            }else{
                res.send()
            }
        }
    }
    res.send(req.url.match(pathregex))
    console.log(req.url.match(pathregex))
    next()
})
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
function dl(url){
    console.log(' ➤ [[ !!! TRYING TO DOWNLOAD FILE !!! ]] Downloading file from ' + url)
    const match =req.url.match(pathregex)[0];
    if (!!match){
        const twitter_url = "https://twitter.com/"+ match;
    }
    //continue here
}