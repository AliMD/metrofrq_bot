# MetroFrq Bot
Check [MetroFrq Website](http://metrofrq.ir/) and [Telegram Bot](http://telegram.me/metrofrq_bot)

# Make app with openshift.com
```
rhc app-create --app MetroFrqBot https://raw.githubusercontent.com/icflorescu/openshift-cartridge-nodejs/master/metadata/manifest.yml --env NODE_VERSION_URL=https://semver.io/node/resolve/6 NPM_VERSION_URL=https://semver.io/npm/resolve/3 BABEL_CACHE_PATH=\$DATA_DIR/babel.cache.json BOT_TOKEN=YourBotTocken --no-scaling  --from-code https://github.com/AliMD/metrofrq_bot.git --no-git 
``` 
