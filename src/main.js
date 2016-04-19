/**
 * OneCast Bot
 */

import telegramBot from 'telegram-bot-api';
import {l10n} from './i18n';
import {read, write} from './files';

var

config = {
  bot: {},
  token: process.env.BOT_TOKEN,
  saveInterval: 5000, // ms
  updateInterval: 1000, //ms
  waitForPosts: 1000, //ms
  admins: [58389411, 34815606], //, 65195363 TODO: load from external config
  debugMsgs: false
},

data = {
  users: null,
  posts: null
},

init = () => {
  console.log('Init');
  if(!config.token){
    console.log('BOT_TOKEN not found!');
    return false;
  }
  loadData();
  makeBot();
  botEvents();
  getBotInfo();

  notifyAdmins(`Bot engine restarted!`);
},

bot,
makeBot = function (){
  console.log('makeBot');
  bot = new telegramBot({
    token: config.token,
    updates: {
      enabled: true,
      get_interval: config.updateInterval
    }
  });
},

botEvents = () => {
  bot.on('message', onMessage);
  bot.on('inline.query', onInlineQuery);
  bot.on('inline.result', onInlineResult);
  bot.on('inline.callback.query', onInlineCallbackQuery);
},

loadData = () => {
  console.log('loadData');

  data.posts = read('posts', {});
  console.log(`${Object.keys(data.posts).length} posts loaded`);

  data.users = read('users', {});
  console.log(`${Object.keys(data.users).length} users loaded`);
},

getBotInfo = () => {
  console.log('getBotInfo');
  // console.log(`token: ${config.token}`);
  bot.getMe((err, data) => {
    if (data && data.username)
    {
      console.log(data);
      config.bot = data;
    }
    else
    {
      console.log('error!');
      console.log(err);
      setTimeout(getBotInfo, 1000);
    }
  });
},

REGEXPS = {
  subscribe: /start|subscribe|عضویت/i,
  unsubscribe: /stop|unsubscribe|لغو\s*عضویت/i,
  hello: /hi|hello|welcome|salam|سلام|درود|خوش\s*[اآ]مدی/i
},
//TODO: fix msg text length

requestMessage = {},

stringify = (obj) => {
  return JSON.stringify(obj, null, 2)
},

onMessage = (msg) => {
  console.log(`===> ${msg.from.username}: ${msg.text}`);
  // console.log(stringify(msg));

  let
  msgDate = new Date(msg.date*1000),
  fromAdmin = isAdmin(msg.chat.id)
  ;
  console.log(msgDate.toLocaleString());

  if(fromAdmin && config.debugMsgs)
  {
    let buildMessage = makeMessageObj(msg);
    notifyAdmins('Debug: ' + JSON.stringify({sourceMessage: msg, buildMessage: buildMessage}, null, 2));
    notifyAdmins(buildMessage);
    // notifyAdmins(buildMessage.id, buildMessage.from);
  }


  //remove bot username
  if(msg.text)
  {
    msg.text = msg.text.replace(`@${config.bot.username} `, '');
  }

  // Special messages
  if(typeof requestMessage[msg.chat.id] === 'function')
  {
    requestMessage[msg.chat.id](msg);
    return;
  }
  if(typeof requestMessage[msg.from.id] === 'function')
  {
    requestMessage[msg.from.id](msg);
    return;
  }

  //Start or Subscribe
  if (REGEXPS.subscribe.test(msg.text))
  {
    let offset = "/start ".length;
    if(msg.text.length>offset) {
      if(!checkSubscribed(msg.from.id)) subscribe(msg.from);
      msg.text = msg.text.substr(offset);
    } else {
      subscribe(msg.from); // TODO: fix bug on user sent start in group
      return;
    }
    // if (msg.chat.id !== msg.from.id && !checkSubscribed(msg.chat.id))
    // {
    //   subscribe(msg.chat);
    // }
  }

  //Debug and test
  // if (msg.text === 'dalli')
  // {
  //   zmba_iv = setInterval(() => {
  //     sendText(msg.chat.id, 'Dalli !');
  //   }, 2500);
  //   return;
  // }
  // if (zmba_iv && msg.text === 'cancel')
  // {
  //   clearInterval(zmba_iv);
  //   zmba_iv = 0;
  // }

  // help
  // if (REGEXPS.help.test(msg.text))
  // {
  //   sendPost(msg.chat.id, 0); // post 0 always is help
  //   return;
  // }

  // about
  // if (REGEXPS.about.test(msg.text))
  // {
  //   sendText(msg.chat.id, l10n('about').replace('%name%', msg.from.first_name));
  //   return;
  // }


  //Hello
  if (REGEXPS.hello.test(msg.text))
  {
    sendText(msg.chat.id, l10n('hello').replace('%name%', msg.from.first_name));
    return;
  }


  //Chat Join
  if(msg.new_chat_participant && msg.new_chat_participant.id === config.bot.id)
  {
    console.log(`chatJoin: ${msg.chat.title}`);
    subscribe(msg.chat, msg.from);
    if (!checkSubscribed(msg.from.id)) subscribe(msg.from);
    return;
  }

  //User Unsubscribe
  if (REGEXPS.unsubscribe.test(msg.text))
  {
    unsubscribe(msg.chat, msg.from, !!msg.chat.title); // silent in group temporary
    return;
    // if (msg.chat.id !== msg.from.id && !checkSubscribed(msg.chat.id))
    // {
    //   subscribe(msg.chat);
    // }
  }

  //Chat Left
  if(msg.left_chat_participant && msg.left_chat_participant.id === config.bot.id)
  {
    console.log(`chatLeft: ${msg.chat.title}`);
    unsubscribe(msg.chat, msg.from, true);
    //TODO: save from
    return;
  }

  // New post
  if(fromAdmin && msg.text === "/newpost")
  {
    recordNewPost(msg.chat.id);
    return;
  }

  //Delete post
  if(fromAdmin && msg.text === "/deletepost") {
    deletePost(msg.chat.id);
    return;
  }

  //Notify admin
  if(fromAdmin && (msg.text || '').trim().indexOf('/notifyadmins ') === 0) {
    msg.text = msg.text.substr('/notifyadmins '.length);
    console.log(msg.text);
    if (msg.text.length>1) notifyAdmins(msg.text);
    return;
  }

  // Send post
  if(msg.text)
  {
    let postId = fixNumbers(msg.text.replace('/','').replace(' ',''));
    if (getPost(postId)) {
      sendPost(msg.chat.id, postId, fromAdmin);
      return;
    }
  }

  // Send Post to All
  if(fromAdmin && (msg.text || '').trim().indexOf('/broadcast') === 0)
  {
    let postId = parseInt(msg.text.replace('/broadcast', '').trim(), 10);
    if(!postId)
    {
      broadcastMessage(msg.chat.id);
    }
    else
    {
      sendPost2All(postId);
    }
    return;
  }

  // upload audio
  // if(fromAdmin && (msg.text || '').trim().indexOf('/uploadaudio ') === 0)
  // {
  //   uploadAudio(msg.chat.id, msg.text.replace('/uploadaudio ', '').trim());
  //   return;
  // }

  // status
  if(fromAdmin && (msg.text || '').trim().indexOf('/status') === 0)
  {
    sendStatus(msg.chat.id);
    return;
  }

  // swap debug mode
  if(fromAdmin && (msg.text || '').trim().indexOf('/debug') === 0)
  {
    config.debugMsgs = !config.debugMsgs;
    sendMessage(msg.chat.id, {text: 'Debug Turn ' + (config.debugMsgs ? 'On' : 'Off')});
    return;
  }

  // make backup
  if(fromAdmin && (msg.text || '').trim().indexOf('/backup') === 0)
  {
    makeBackup(msg.from.id);
    return;
  }

  // restore backup
  if(fromAdmin && (msg.text || '').trim().indexOf('/restore') === 0)
  {
    restoreBackup(msg.from.id);
    return;
  }

  // send log
  if(fromAdmin && (msg.text || '').trim().indexOf('/log') === 0)
  {
    sendLog(msg.from.id);
    return;
  }

  // Send all medias
  if(fromAdmin && msg.text === "/sendallmedias")
  {
    sendAllMedias(msg.chat.id);
    return;
  }

  // Update medias
  if(fromAdmin && msg.text === "/updatemedias")
  {
    updateMediasIds(msg.chat.id);
    return;
  }

  // reload data
  if(fromAdmin && (msg.text || '').trim().indexOf('/reload') === 0){
    loadData();
    notifyAdmins('Data reloaded');
    return;
  }

  //Notify other messages to admin
  // msg.data = msgDate.toLocaleString();
  if(!fromAdmin && !msg.new_chat_title && !msg.new_chat_participant && !msg.left_chat_participant && !msg.new_chat_photo && !msg.delete_chat_photo)
  {
    notifyAdmins('unknownMessage: ' + JSON.stringify(msg, null, 2));
    notifyAdmins(msg.message_id, msg.from.id);
  }
},

onInlineQuery = (query) => {
  console.log("===> onInlineQuery: ", stringify(query));

  var
  post = data.posts['test'].messages,
  results = [{
  //   type: "photo",
  //   id: "1",
  //   photo_file_id: post[0].photo.id,
  //   title: "title1",
  //   description: "description1",
  //   caption: "caption1"
  // },
  //{
    type: "audio",
    id: "2",
    audio_file_id: post[1].audio.id,
    title: post[1].audio.title,
    performer: post[1].audio.performer
  },
  {
    type: "audio",
    id: "3",
    audio_file_id: post[1].audio.id,
    title: post[1].audio.title,
    performer: post[1].audio.performer
  },
  {
    type: "audio",
    id: "4",
    audio_file_id: post[1].audio.id,
    title: post[1].audio.title,
    performer: post[1].audio.performer
  }]
  ;

  console.log("results: " + stringify(results));

  bot.answerInlineQuery({
    inline_query_id: query.id,
    results: results,
    cache_time: "1",
    is_personal: "false",
    next_offset: ""
    // switch_pm_text: "",
    // switch_pm_parameter: ""
  }, (err, data) => {
    console.log("answerInlineQueryCallback: " + stringify({err: err, query: query}));
  })
  .then((data) => {
    console.log("answerInlineQuerySuccess: " + stringify(data))
  })
  .catch((err) => {
    console.log("answerInlineQueryError: " + stringify({err: err, query: query}));
  })
  ;
},

onInlineResult = (query) => {
  console.log("===> onInlineResult: ", stringify(query));
},

onInlineCallbackQuery = (query) => {
  console.log("===> onInlineCallbackQuery: ", stringify(query));
},


subscribe = (user, from) => {
  console.log('subscribe');
  console.log(user);

  let usr = {};
  if (user.title) // type is group
  {
    usr.title = user.title;

    sendText(user.id, l10n('group_subscribed').replace('%name%', from.first_name).replace('%title%', user.title));
    if(from && from.id) sendText(from.id, l10n('thanks_for_add_to_group').replace('%name%', from.first_name).replace('%title%', user.title));
  }
  else
  {
    if (checkSubscribed(user.id))
    {
      sendText(user.id, l10n('already_subscribed'));
      return;
    }

    usr.first_name = user.first_name;
    usr.last_name = user.last_name;
    if (user.username) usr.username = user.username;

    sendText(user.id, l10n('user_subscribed').replace('%name%', user.first_name));
  }

  data.users[user.id] = usr;
  saveContents();
  notifyAdmins(`New user subscribe: ${JSON.stringify({user: user, from: from}, null, 2)}`);
},

unsubscribe = (user, from, silent = false) => {
  console.log('unsubscribe!!!');
  console.log(user);

  if(!checkSubscribed(user.id))
  {
    if(!silent) sendText(user.id, l10n('not_subscribed').replace('%name%', user.first_name));
    return;
  }
  data.users[user.id].stoped = true;
  if(!silent) sendText(user.id, l10n('unsubscribed').replace('%name%', user.first_name));
  saveContents();
  //TODO: send some quite message
  notifyAdmins(`user unsubscribe: ${JSON.stringify({user: user, from: from}, null, 2)}`);
},

lastTimeout = 0,
saveContents = (force) => {
  console.log(`saveContents: ${force?'force':'request'}`);
  if (force)
  {
    lastTimeout = 0;
    write('users', data.users);
    write('posts', data.posts);
  }
  else
  {
    if(lastTimeout) clearTimeout(lastTimeout);
    lastTimeout = setTimeout(saveContents, config.saveInterval, true);
  }
},

sendText = async (id, text) => {
  let username = data.users[id] ?
                  data.users[id].username ? `@${data.users[id].username}` : `${data.users[id].title}`
                  : `#${id}`;
  console.log(`sendText(${username}): ${text}`);
  return bot.sendMessage({
    chat_id: id,
    text: text
  })
  .catch((err) => {
    console.log(`sendText error: ${stringify(err)}`);
  });
},

sendMessage = async (id, message) => {
  let username = data.users[id] ?
                  data.users[id].username ? `@${data.users[id].username}` : `${data.users[id].title}`
                  : `#${id}`;
  console.log(`sendMessage(${username}): #${message.id}`);

  var callBack = (err) => {
    console.log(`sendMessage err: ${stringify(err)}`);
  }

  if (message.text) {
    console.log(`bot.sendMessage: ${message.text}`);
    return bot.sendMessage({
      chat_id: id,
      text: message.text
    })
    .catch(callBack);
  }

  else if (message.audio) {
    console.log(`bot.sendAudio: ${message.audio.id}`);
    return bot.sendAudio({
      chat_id: id,
      audio: message.audio.id,
      performer: message.audio.performer,
      title: message.audio.title
    })
    .catch(callBack);
  }

  else if (message.voice) {
    console.log('bot.sendVoice');
    // TODO: fix sendVoice
    return bot.sendAudio({
      chat_id: id,
      audio: message.voice.id
    })
    .catch(callBack);
  }

  else if (message.sticker) {
    console.log('bot.sendSticker');
    return bot.sendSticker({
      chat_id: id,
      sticker: message.sticker.id
    })
    .catch(callBack);
  }

  else if (message.photo) {
    console.log('bot.sendPhoto');
    return bot.sendPhoto({
      chat_id: id,
      photo: message.photo.id
      //TODO: fix caption
    })
    .catch(callBack);
  }

  else if (message.contact) {
    console.log('bot.sendContact');
    //TODO: fix sendContact
  }

  else if (message.document) {
    console.log('bot.sendDocument');
    return bot.sendDocument({
      chat_id: id,
      document: message.document.id
    })
    .catch(callBack);
  }
},

checkSubscribed = (id) => {
  return !!data.users[id] && !data.users[id].stoped;
},

sentUnfinishedMessage = () => {
  // TODO: sent unfinished message from a waiting list
},

notifyAdmins = (msg, fromId) => {
  console.log(`notifyAdmins`);
  config.admins.forEach((admin)=>{
    // if(typeof msg === 'object' && msg.message_id)
    // {
    //   bot.forwardMessage({
    //     chat_id: admin,
    //     from_chat_id: msg.from.id,
    //     message_id: msg.message_id
    //   });
    //   let obj = {id:msg.message_id, from: msg.from};
    //   if(msg.from.id !== msg.chat.id) obj.chat = msg.chat;
    //   sendText(admin, JSON.stringify(obj, null, 2));
    //   return true;
    // }
    if(typeof msg === 'object')
    {
      console.log(`notifyAdmins: sendMessage`);
      sendMessage(admin, msg);
    }
    else if (typeof msg === 'string') {
      console.log(`notifyAdmins: sendText`);
      sendText(admin, msg);
    }
    else if (!isNaN(msg)) {
      // msg in a message id
      console.log(`notifyAdmins: forwardMessage`);
      bot.forwardMessage({
        chat_id: admin,
        from_chat_id: fromId,
        message_id: msg
      });
    }
    else {
      console.log('notifyAdmins msg type err!');
    }
  });
},

isAdmin = (id) => {
  return config.admins.indexOf(parseInt(id, 10)) > -1;
},

recordNewPost = (userId) => {
  console.log(`recordNewPost: ${userId}`);
  if(requestMessage[userId])
  {
    sendText(userId, 'Please /cancel last action.');
    return;
  }

  let postId = '', msgs = [];
  sendText(userId, 'Recording...\nYou can /cancel or /end the process any time.\n\nPlease enter post id.');

  requestMessage[userId] = (msg) => {
    if(msg.text === '/cancel')
    {
      delete requestMessage[userId];
      sendText(userId, `Ok, recording cancel!\n${msgs.length} has been lost.`);
      return;
    }

    if(!postId)
    {
      let id = msg.text.trim();
      if(id)
      {
        postId = fixNumbers(id);
        sendText(userId, `Ok, please enter your messages in any type ;)`);
      }
      else
      {
        sendText(userId, `Please enter valid post id.`);
      }
      return;
    }

    if(msg.text === '/end')
    {
      delete requestMessage[userId];
      setPost(postId, {
        from: userId,
        messages: msgs,
        sent_count: 0
      });
      sendText(userId, `Ok, recording end\n${msgs.length} messages recorded for post_id:${postId}`);
      return;
    }

    msgs.push(makeMessageObj(msg));
  }
},

// build message object for store in posts.json
makeMessageObj = (sourceMessage) => {
  let message = {
    id: sourceMessage.message_id,
    from: sourceMessage.from.id,
    chat: sourceMessage.chat.id,
    date: sourceMessage.date
  }

  if (sourceMessage.text) {
    message.text = sourceMessage.text
  }

  else if (sourceMessage.audio)
  {
    message.audio = {
      id: sourceMessage.audio.file_id,
      type: sourceMessage.audio.mime_type,
      size: sourceMessage.audio.file_size,
      duration: sourceMessage.audio.duration,
      // TODO: get performer and title from user
      performer: sourceMessage.audio.performer,
      title: sourceMessage.audio.title
    }
  }

  else if (sourceMessage.voice)
  {
    message.voice = {
      id: sourceMessage.voice.file_id,
      type: sourceMessage.voice.mime_type,
      size: sourceMessage.voice.file_size,
      duration: sourceMessage.voice.duration
    }
  }

  else if (sourceMessage.sticker) {
    message.sticker = {
      id: sourceMessage.sticker.file_id,
      size: sourceMessage.sticker.file_size
      // TODO: get caption
    }
  }

  else if (sourceMessage.photo && sourceMessage.photo.length) {
    let photo = sourceMessage.photo.pop(); // get largest size of the photo
    message.photo = {
      id: photo.file_id,
      size: photo.file_size,
      width: photo.width,
      height: photo.height
      // TODO: get caption
    }
  }

  else if (sourceMessage.contact) {
    message.contact = sourceMessage.contact;
    // get phone_number, first_name, last_name, user_id from user
  }

  else if (sourceMessage.document) {
    message.document = {
      id: sourceMessage.document.file_id,
      type: sourceMessage.document.mime_type,
      size: sourceMessage.document.file_size
      // TODO: get caption
    }
  }

  //TODO: video, location

  return message;
},

persianNumbers = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g],
arabicNumbers  = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g],
fixNumbers = (str) => {
  // console.log(`fixNumbers: ${str}`);
  if(typeof str === 'string')
  {
    for(let i=0; i<10; i++)
    {
      str = str.replace(persianNumbers[i], i).replace(arabicNumbers[i], i);
    }
  }
  return str;
},

sendPost = async (userId, postId, skipCount=false) => {
  console.log(`sendPost: ${postId} to ${userId}`);
  var post = getPost(postId);

  for(let i in post.messages) {
    await sendMessage(userId, post.messages[i]);
  }

  if (!skipCount) {
    post.sent_count++;
    saveContents();
  }
},

getPost = (postId) => {
  postId = (postId+'').toLowerCase().trim().replace(' ', '_');
  // console.log(`getPost: ${postId}`);
  return data.posts[postId];
},

setPost = (postId, postContent) => {
  postId = (postId+'').toLowerCase().trim().replace(' ', '_');
  if(data.posts[postId]) {
    // keep sent_count in post updates
    postContent.sent_count = data.posts[postId].sent_count;
  }
  data.posts[postId] = postContent;
  sortPosts();
  saveContents();
},

sendPost2All = (postId) => {
  console.log(`sendPost2All: ${postId}`);
  notifyAdmins(`sendPost2All: ${postId}`);

  if(!postId || !getPost(postId))
  {
    notifyAdmins(`sendPost2All: post id not found`);
    return;
  }

  let users = Object.keys(data.users);
  users.forEach( (userId, i) => {
    if(data.users[userId].stoped) return true;
    setTimeout(() => {
      sendPost(userId, postId);
    }, i*config.waitForPosts*2);
  });

  setTimeout(() => {
    notifyAdmins(`Post ${postId} sent`);
  }, (users.length+5)*config.waitForPosts*2);
},

broadcastMessage = (userId) => {
  console.log(`broadcastMessage: ${userId}`);
  if(requestMessage[userId])
  {
    sendText(userId, 'Please /cancel last action.');
    return;
  }

  let end = false, msgs = [];
  sendText(userId, 'Recording...\nYou can /cancel or /end the process any time.');
  requestMessage[userId] = (msg) => {
    if(msg.text === '/cancel')
    {
      delete requestMessage[userId];
      sendText(userId, `Ok, recording cancel!\n${msgs.length} has been lost.`);
      return;
    }

    if(msg.text === '/end')
    {
      sendText(userId, `Ok, recording end\n${msgs.length} messages recorded\n\nNext ?\n/cancel\n/preview\n/send2all`);
      end = true;
      return;
    }

    if(end && msg.text === '/preview')
    {
      for(let i=0, msglen = msgs.length; i < msglen; i++)
      {
        setTimeout((i) => {
          if(typeof msgs[i] === 'string')
          {
            bot.sendMessage({
              chat_id: userId,
              text: msgs[i]
            })
          }
          else
          {
            bot.forwardMessage({
              chat_id: userId,
              from_chat_id: userId,
              message_id: msgs[i]
            });
          }
        }, i*config.waitForPosts, i);
      }
      setTimeout(() => {
        sendText(userId, `Next ?\n/cancel\n/preview\n/send2all`);
      }, msgs.length*config.waitForPosts);
      return;
    }

    if(end && msg.text === '/send2all')
    {
      delete requestMessage[userId];

      let users = Object.keys(data.users);
      users.forEach( (uid, i) => {
        if(data.users[uid].stoped) return true;
        setTimeout(() => {
          for(let i=0, msglen = msgs.length; i < msglen; i++)
          {
            setTimeout((i) => {
              let sendErr = (err, dt) => {
                if(err)
                {
                  let debug = JSON.stringify({err: err, data: dt}, null, 2);
                  let errmsg = `send2all to ${uid} error in forward message_id ${msgs[i]}\n${debug}`;
                  console.log(errmsg);
                  notifyAdmins(errmsg);
                }
              };

              if(typeof msgs[i] === 'string')
              {
                bot.sendMessage({
                  chat_id: uid,
                  text: msgs[i]
                }, sendErr)
              }
              else
              {
                bot.forwardMessage({
                  chat_id: uid,
                  from_chat_id: userId,
                  message_id: msgs[i]
                }, sendErr);
              }
            }, i*config.waitForPosts, i); //TODO: use another var time calc, i skipped for stoped users
          }
        }, i*config.waitForPosts*2);
      });

      setTimeout(() => {
        notifyAdmins(`messages sent`);
      }, (users.length+msgs.length)*config.waitForPosts);

      return;
    }

    if(!end)
    {
      msgs.push(msg.text && msg.text.length > 0 ? msg.text : msg.message_id);
    }
  }
},

uploadAudio = (userId, path) => {
  console.log(`uploadAudio for user ${userId}: ${path}`);

  var
  notifyfn = () => {
    console.log('send sendChatAction upload_audio');
    bot.sendChatAction({
      chat_id: userId,
      action: 'upload_audio'
    });
  },
  notifyIv = setInterval(notifyfn, 5000)
  ;

  bot.sendAudio({
    chat_id: userId,
    audio: path.trim()
  }, (err, data) => {
    let debug = JSON.stringify({err: err, data: data}, null, 2);
    console.log(`audioSent\n${debug}`);
    clearInterval(notifyIv);
    sendText(userId, debug);
  });
  notifyfn();
},

sendStatus = (userId) => {
  console.log(`sendStatus to ${userId}`);
  let status = {
    'Users': 0,
    'Groups': 0,
    'Users Stoped': 0,
    'Groups Stoped': 0,
    'All Users': 0,

    'Posts Sent': {},
    'Posts Length': 0,
    'All Posts Sent': 0
  };

  // Users calc
  let users = Object.keys(data.users); // array of all user id's
  status['All Users'] = users.length;
  users.forEach( (userId, i) => {
    if(userId>0)
    {
      status[data.users[userId].stoped ? 'Users Stoped' : 'Users']++;
    }
    else
    {
      status[data.users[userId].stoped ? 'Groups Stoped' : 'Groups']++;
    }
  });

  // Posts calc
  let posts = Object.keys(data.posts); // array of all post id's
  status['Posts Length'] = posts.length;
  posts.forEach( (postId, i) => {
    status['Posts Sent'][postId] = (getPost(postId) || {}).sent_count;
    status['All Posts Sent'] += status['Posts Sent'][postId] || 0;
  });

  let breakStr = '  "Posts Sent"';
  sendText(userId, JSON.stringify(status, null, 2).replace(breakStr, '\n'+breakStr));
},

makeBackup = async (userId) => {
  console.log('makeBackup');
  saveContents(true);

  // var callBack = (err) => {
  //   let errDesc = stringify(err);
  //   console.log(`makeBackup error: ${errDesc}`);
  //   sendText(userId, errDesc)
  //   .then(() => {
  //     reject(err);
  //   });
  // };

  await bot.sendDocument({
    chat_id: userId,
    document: 'stores/posts.json'
  })
  await bot.sendDocument({
    chat_id: userId,
    document: 'stores/users.json'
  })

  return true;
},

restoreBackup = async (userId) => {
  console.log('restoreBackup');

  await sendText(userId, "Make backup first")
  await makeBackup(userId)

  // TODO: restore backup ...
  await sendText(userId, "restore is under develope ;)");
},

sendLog = (userId) => {
  console.log('sendLog');

  let callBack = (err, data) => {
    if (!err) return;
    // else
    let
    errObj = JSON.stringify({err: err, data: data}, null, 2),
    errDesc = `makeBackup error!\n${errObj}`
    ;
    console.log(errDesc);
    sendText(userId, errDesc);
  }

  bot.sendDocument({
    chat_id: userId,
    document: 'console.log'
  }, callBack);
},

sortPosts = () => {
  console.log('sortPosts');
  let
  newPosts = {},
  posts = Object.keys(data.posts)
  ;

  // sort posts with numerical support
  posts.sort(function (a, b){
    return a.localeCompare(b, 'en', {numeric: true});
  });

  // save new posts
  posts.forEach( (postId, i) => {
    newPosts[postId] = data.posts[postId];
  });
  data.posts = newPosts;
  saveContents();
},

deletePost = async (userId) => {
  var postIds = Object.keys(data.posts);
  await sendText(userId, `Select post number from 0 to ${postIds.length-1}\n\nor /cancel`);

  var msg = 'list of posts :\n\n';
  for(let i in postIds) {
    msg += `${i}: ${postIds[i]}\n`;
  }
  await sendText(userId, msg);

  requestMessage[userId] = async (msg) => {
    if(msg.text === '/cancel') {
      delete requestMessage[userId];
    }

    let id = parseInt(fixNumbers(msg.text));
    if(!isNaN(id) && id>-1 && id<postIds.length) {
      await sendText(userId, 'Sending backup before change.');
      await makeBackup(userId);

      delete data.posts[postIds[id]];
      delete requestMessage[userId];
      saveContents();

      sendText(userId, `Post "${postIds[id]}" deleted!`);
    } else {
      await sendText(userId, `Please send a valid number (0 - ${postIds.length-1})`);
    }
  }
},

// Send all media to forward to other bot for update media id
sendAllMedias = async (userId) => {
  console.log("sendAllMedias");

  for (let postId in data.posts) {
    // console.log(postId);
    let post = data.posts[postId];
    for (let messageId in post.messages) {
      // console.log(messageId);
      let message = post.messages[messageId];
      if(message.audio || message.photo) { //TODO: add other types
        await sendMessage(userId, message);
      }
    }
  }

  await sendText(userId, "Finished ;)");
  return true;
},

matchText = (str1, str2) => {
  var matched = 0;
  for (let i=0; i<str1.length; i++) {
    if (str1[i] === str2[i]) {
      matched++;
    }
  }
  return (matched / Math.max(str2.length));
},

updateMediasIds = async (userId) => {
  await sendText(userId, 'send medias or /end');

  requestMessage[userId] = async (msg) => {
    console.log(msg);

    if (msg.text === '/end') {
      saveContents();
      await sendText(userId, "Finished.");
      delete requestMessage[userId];
      return;
    }

    var
    userMedia = msg.audio
    ;

    // if (msg.photo) {
    //   userMedia = msg.photo[msg.photo.length-1].file_id;
    // }

    if (!userMedia) {
      await sendText(userId, 'Please send valid media!');
      return;
    }

    for (let postId in data.posts) {
      // console.log(postId);
      let post = data.posts[postId];
      for (let messageId in post.messages) {
        // console.log(messageId);
        let
        message = post.messages[messageId],
        postMedia = message.audio
        ;

        if (!postMedia) {
          continue;
        }

        let matched = matchText(postMedia.id, userMedia.file_id);
        if (
          matched > 0.5 &&
          postMedia.type == userMedia.mime_type &&
          postMedia.size == userMedia.file_size &&
          postMedia.performer == userMedia.performer &&
          postMedia.title == userMedia.title
        ) {
          postMedia.id = userMedia.file_id;
          await sendText(userId, `Post "${postId}" updated ;)`);
        }
      }
    }
  }
}
;

init();
