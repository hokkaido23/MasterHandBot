const {prefix, token} = require('./config.json');
const Discord = require('discord.js');
const client = new Discord.Client();
const SQLite = require("better-sqlite3");
const sql = new SQLite('./scores.sqlite');
const cooldownMode = new Set();

//From here to line 27: Start, initialize table and bot status. You know, the fun stuff.
client.once('ready', async () => {
    
    const table = sql.prepare("SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'scores';").get();
    if (!table['count(*)']) {

      sql.prepare("CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, username TEXT, guild TEXT, points INTEGER);").run();

      sql.prepare("CREATE UNIQUE INDEX idx_scores_id ON scores (id);").run();
      sql.pragma("synchronous = 1");
      sql.pragma("journal_mode = wal");
    }

    client.getScore = sql.prepare("SELECT * FROM scores WHERE user = ? AND username = ? AND guild = ?");
    client.setScore = sql.prepare("INSERT OR REPLACE INTO scores (id, user, username, guild, points) VALUES (@id, @user, @username, @guild, @points);");
    client.user.setActivity('FullMetal Alchemist', {
        type: 'WATCHING'
    }).catch(console.error);
    //the "ready!" message, referencing the unused Melee Marth voice line "Let's Dance!".
    console.log('レッツダンス！');
});

//From here to line 36: Surprise tools that will help us later.
function addPoints() {
    return 15;
}

function losePoints() {
    return 10;
}

client.on('message', async message => {
    //Intialize prefix and commands, whether a dm is used, and scores
    if (!message.content.startsWith(prefix) || message.author.bot || message.channel.type === "dm") return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const tagged = message.mentions.users.first();

    let score = client.getScore.get(message.author.id, message.author.username, message.guild.id);
 
    //Create a new score if a new user uses the bot
    if (!score) {
        score = {
          id: `${message.guild.id}-${message.author.id}`,
          user: message.author.id,
          username: message.author.username,
          guild: message.guild.id,
          points: 0
        }
    }

    switch(command) {
        case 'setwin':
            //Makes sure the command has the right syntax, and if the user is on the cooldown list.
            if(cooldownMode.has(message.author.id)){
                return message.reply('Please wait a few seconds before using this command again.');
            }
            if (!message.mentions.users.size) {
                return message.reply(`You did not mention your opponent.`);
            }    
            if(message.mentions.users.first() == message.author) {
                return message.reply('You can\'t win a set against yourself!')
            }

            await message.channel.send('Waiting for opponent to type ";confirm" to confirm results. 30 seconds remain.');

            //Waits for confirmation from losing player for 30 seconds
            const confirm = await message.channel.awaitMessages(msg => {
                console.log(msg.content);
                return msg.content.includes(';confirm');
            }, {time: 30000});

            //Add points to the winning player, subtracts points from losing player.
            if(confirm.map(msg => msg.content)[0] == ';confirm' && confirm.map(msg => msg.author.username) == tagged.username) {
                message.channel.send('Results confirmed.')
                score.points += addPoints();

                let userscore = client.getScore.get(tagged.id, tagged.username, message.guild.id);
                if (!userscore) {
                    userscore = { id: `${message.guild.id}-${tagged.id}`, user: tagged.id, username: tagged.username, guild: message.guild.id, points: 0 }
                }

                let b = losePoints();
                if(userscore.points < b) {
                    userscore.points = 0;
                }else{
                    userscore.points -= b;
                }

                score.points += addPoints();

                client.setScore.run(score);
                client.setScore.run(userscore);
    
                //Final annnoucement.
                message.channel.send(`**${message.author.username}** wins set vs. **${tagged.username}**.\nPoints recorded and applied.`);
                console.log(';setwin used.')
                //Adds user to cooldown list
                cooldownMode.add(message.author.id);
                setTimeout(() => {
                    cooldownMode.delete(message.author.id)
                }, 5000);
            }else{
                message.channel.send('Results not confirmed. No changes made.');
                console.log(';setwin used.')
                cooldownMode.add(message.author.id);
                setTimeout(() => {
                    cooldownMode.delete(message.author.id)
                }, 5000);
                return;
            }
            break;
        case 'setloss':

            //blah blah blah (The same as the code in the ;setwin block, except reversed where scores are concerned.)
            if(cooldownMode.has(message.author.id)){
                return message.reply('Please wait a few seconds before using this command again.');
            }
            if (!message.mentions.users.size) {
                return message.reply(`You did not mention your opponent`);
            }    
            if(message.mentions.users.first() == message.author) {
                return message.reply('You can\'t lose a set against yourself!')
            }

            await message.channel.send('Waiting for opponent to type ";confirm" to confirm results. 30 seconds remain.');

            const confirm2 = await message.channel.awaitMessages(msg => {
                console.log(msg.content);
                return msg.content.includes(';confirm');
            }, {time: 30000});

            if(confirm2.map(msg => msg.content)[0] == ';confirm' && confirm2.map(msg => msg.author.username) == tagged.username) {
                message.channel.send('Results confirmed.')

                let a = losePoints();
                if(score.points < a) {
                    score.points = 0;
                }else{
                    score.points -= a;
                }

                let userscore = client.getScore.get(tagged.id, tagged.username, message.guild.id);
                if (!userscore) {
                    userscore = { id: `${message.guild.id}-${tagged.id}`, user: tagged.id, username: tagged.username, guild: message.guild.id, points: 0 }
                }
                userscore.points += addPoints();
                client.setScore.run(score);
                client.setScore.run(userscore);

                message.channel.send(`**${tagged.username}** wins set vs. **${message.author.username}**.\nPoints recorded and applied.`);
                
                console.log(';setloss used.')
                cooldownMode.add(message.author.id);
                setTimeout(() => {
                    cooldownMode.delete(message.author.id)
                }, 5000);

            }else{
                message.channel.send('Results not confirmed. No changes made.');
                console.log(';setloss used.')
                cooldownMode.add(message.author.id);
                setTimeout(() => {
                    cooldownMode.delete(message.author.id)
                }, 5000);
                return;
            }
            break;
        case 'points':
            if(cooldownMode.has(message.author.id)){
                return message.reply('Please wait a few seconds before using this command again.');
            }
            const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
            let player = client.getScore.get(user.id, message.author.username, message.guild.id)
            if (!player) {
                player = { id: `${message.guild.id}-${user.id}`, user: user.id, username: user.username, guild: message.guild.id, points: 0 }
            }   
            message.channel.send(`${player.username}\'s Points: **${player.points}**`);
            console.log(';points used.')

            cooldownMode.add(message.author.id);
            setTimeout(() => {
                cooldownMode.delete(message.author.id)
            }, 5000);

            break;
        case 'leaderboard':
            //For the sweats. Grabs the first 20 players on the leaderboard, and displays them.
            if(cooldownMode.has(message.author.id)){
                return message.reply('Please wait a few seconds before using this command again.');
            }
            const top20 = sql.prepare("SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 20;").all(message.guild.id);
            //Create a discord embed to display info in a professional format.
            const Embed = new Discord.MessageEmbed()
            .setTitle("Leaderboard")
            .setAuthor(`Requested by: ${message.author.username}`, message.author.avatarURL())
            .setDescription("The Top 20 leaders in The Battlefields.")
            //use the smash bros wiki master hand picture because I can't seem to find a better alternative.
            .setThumbnail('https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png')
            .setColor('#3a243b')
            .setTimestamp()
            .setFooter('Leaderboards', 'https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png');

            //This piece of shit took hours to fix when it broke. 
            for(const scores of top20) {
                Embed.addFields({name: `${scores.username}:`, value: `${scores.points} points` });
            }
            console.log(Embed);
            console.log(';leaderboard used.');
            message.channel.send(Embed);

            cooldownMode.add(message.author.id);
            setTimeout(() => {
                cooldownMode.delete(message.author.id)
            }, 5000);

            break;
        case 'help':
            //For the utterly confused. Reacts to message with a check, and dms the user the help embed. (Or with an X if you couldn't wait 5 seconds.)
            if(cooldownMode.has(message.author.id)){
                message.react('❌');
                return message.reply('Please wait a few seconds before using this command again.');
            }
            message.react('✅');

            //Create a new discord embed. And display all information
            const helpEmbed = new Discord.MessageEmbed()
	        .setColor('#3a243b')
	        .setTitle('Command Help')
	        .setAuthor(`Requested by: ${message.author.username}`, message.author.avatarURL())
	        .setDescription('Guide to all Master Hand\'s commands')
	        .setThumbnail('https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png')
	        .addFields(
                { name: ';setwin', value: 'Use this command to report a win. Gives you points and subtracts opponent\'s points. **Your opponent must use ;confirm within 30 seconds afterwards.**\nFormat: \`;setwin @[player you won against]\`' },
                { name: ';setloss', value: 'Use this command to report a loss. Subtracts your points and gives your opponent points. **Your opponent must use ;confirm within 30 seconds afterwards.**\nFormat: \`;setloss @[player you lost against]\`'},
		        { name: ';info', value: 'Use this command to get info on myself, Master Hand.'},
		        { name: ';leaderboards', value: 'Use this command to get the top 20 players in The Battlefields leaderboards.'},
                { name: ';points', value: 'Use this command to know either your place on the leaderboard, or someone elses.\nFormat: \`;points @[Optional: another player]\`'},
            )
	        .setTimestamp()
	        .setFooter('Command Help', 'https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png');

            message.author.send(helpEmbed);
            //Slide into your dms.
            message.channel.send('Check your DMs.')
            console.log(';help used.')

            cooldownMode.add(message.author.id);
            setTimeout(() => {
                cooldownMode.delete(message.author.id)
            }, 5000);

            break;
        case 'info':
            //Gathers the players around the fireplace, and tells a story.
            if(cooldownMode.has(message.author.id)){
                return message.reply('Please wait a few seconds before using this command again.');
            }
            const infoEmbed = new Discord.MessageEmbed()
            .setColor('#3a243b')
            .setTitle('Info on Master Hand')
            .setAuthor(`Requested by: ${message.author.username}`, message.author.avatarURL())
            .setDescription('For the question: What am I?')
            .setThumbnail('https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png')
            .addFields(
                { name: 'Story', value: 'I am Master Hand, the ever powerful being that has been ~~enslaved~~ recruited by Augustus to serve as a rank system for The Battlefields, on September 26th, 2020.'},
                { name: 'What can I do?', value: 'I am a point system. Think of the gsp system in Smash Ultimate, but only half as broken. You may come to me to find your place or someone elses place in the leaderboards, list the top 20 in the leaderboards, or record a set win to apply points. Do \`;help\` for the command list.'}
            )
            .setTimestamp()
            .setFooter('Master Hand Info', 'https://www.ssbwiki.com/images/2/22/Master_Hand_SSB4.png');
            message.channel.send(infoEmbed)
            console.log(';info used.')

            cooldownMode.add(message.author.id);
            setTimeout(() => {
                cooldownMode.delete(message.author.id)
            }, 5000);

            break;
        //Escape this hellscape of a program.
        default: return;
    }
});

client.login(token);
