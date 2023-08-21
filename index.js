const { Client, EmbedBuilder, GatewayIntentBits, Colors } = require('discord.js');
const config = require("./config.json");
const cron = require('node-cron');
const fs = require('fs');
const waitUntil = require('async-wait-until').waitUntil;

const SCORES_CHANNEL_ID = config.channelId;
const BLAPI_URL = 'https://api.beatleader.xyz';
const BLREPLAY_URL = 'https://replay.beatleader.xyz';
const BEATLEADER_URL = 'https://www.beatleader.xyz';

const BSAPI_URL = 'https://api.beatsaver.com';
const BEATSAVER_URL = 'https://beatsaver.com';

const POST_RANK_10 = 10;
const POST_RANK_100 = 100;
const WEIGHT_TOP_8 = 0.77;
const WEIGHT_TOP_20 = 0.5;

const ENABLED_BSR_COMMAND = true;
const AUTOSTART_SCHEDULE = true;

var TimeFrom;
var TimeTo;

var LastCheck;
var NewCheck;

var PlayersDataText = {};
var PlayersDataJSON;

var working = false;

var task = cron.schedule("*/45 * * * * *", async function () {	

	working = true;

	console.log("");
	console.log("New Iteration");	
	
	NewCheck = new Date(Date.now());
	console.log(NewCheck);
	
	TimeFrom = LastCheck.getTime()/ 1000 | 0;
	TimeTo = NewCheck.getTime()/ 1000 | 0;
	
	for(var i = 0; i < PlayersDataText.length; i++) {	
		console.log("Looking for scores for a player " + (i+1) + " of " + PlayersDataText.length + ": " + PlayersDataText[i].blUserID);
		await DrawScore(PlayersDataText[i].blUserID);	
	}
	
	LastCheck = NewCheck;
	
	console.log('End Iteration');
	console.log("");

	working = false;

}, {
	scheduled: false,
	timezone: "Europe/Minsk"
});

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.login(config.BOT_TOKEN);

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	console.log('Ready!');

	TimeFrom = new Date(Date.now());

	LastCheck = TimeFrom;
	console.log("");	
	console.log(LastCheck);
	console.log("");
	
	try {
		PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
	} catch (error) {
		console.log("playersdata.json not found... create new");
		let NewFile = [ { blUserID: "123456789" } ];
		fs.writeFileSync('playersdata.json', JSON.stringify(NewFile));
	}
		
	PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
	PlayersDataText = JSON.parse(PlayersDataJSON);
	if (PlayersDataText.length>0) { 
		console.log("Founded " + PlayersDataText.length + " players:");
		for(var i = 0; i < PlayersDataText.length; i++) {	
				console.log(PlayersDataText[i].blUserID);
		}
	}	

	if (AUTOSTART_SCHEDULE) {
		console.log("");	
		console.log("Starting monitoring!");
		console.log("");

		task.start();
	}

});

const prefix = "!";

client.on("messageCreate", async function(message) {

	var mapcode = ""; 

	if (message.author.bot) return;
	if (!message.content.startsWith(prefix)) return;

	const commandBody = message.content.slice(prefix.length);
	const args = commandBody.split(' ');
	const command = args.shift().toLowerCase();

	if  (ENABLED_BSR_COMMAND) {
		if ((command === "bsr") || (command === "map")) {
			mapcode = args[0];
			if (mapcode != undefined) {
				let REQ_CHANNEL_ID = message.channel.id;
				if (IsHex(mapcode)) {
					console.log("Map code received!");
					await DrawMap(mapcode, REQ_CHANNEL_ID);	
				} else {
					client.channels.fetch(REQ_CHANNEL_ID)
					.then(channel=> channel.send('Invalid map code!'));
				}
			}			
		}    
	}
});

client.on('interactionCreate', async interaction => {
	var cancelProcess = false;
	
	if (!interaction.isCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'link') {

		var userID = interaction.options.getString('userid');

        if(isNaN(userID)) {
            await interaction.reply({ content: `That is not a valid ID!`, ephemeral: true });
			cancelProcess = true;
        }

		PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
		PlayersDataText = JSON.parse(PlayersDataJSON);

		if (PlayersDataText.length>0) { 
			for(var i = 0; i < PlayersDataText.length; i++) {	
				if(PlayersDataText[i].blUserID == userID) {
					await interaction.reply({ content: `That account is already linked!`, ephemeral: true });
					cancelProcess = true;
				}
			}	
		}

		if (!cancelProcess) {

			await interaction.deferReply();

			let url = BLAPI_URL + "/player/" + userID;

			await fetch(url, { method: "GET" })
			.then((response) => {
				if (response.ok) {
					return response.json();
				} else {
					console.log("Error: " + response.status);
					cancelProcess = true;
				}
			})
			.then(async (json) => {	
				if (json.name != undefined) console.log("Account found!");
			})
			.catch(async (error) => {
				console.log("Account does not exist!");
				await interaction.editReply({ content: `Account does not exist!`, ephemeral: true });
				console.log("");
				cancelProcess = true;
			});

			if (!cancelProcess) {
			
				await waitUntil(() => !working, { timeout : Infinity });

				console.log("");	
				console.log("Stop monitoring!");
				console.log("");

				task.stop();

				var NewPlayer = { blUserID: userID };

				try {
					PlayersDataText.push(NewPlayer);
					fs.writeFileSync('playersdata.json', JSON.stringify(PlayersDataText));
					console.log("Account " + userID + " has been linked!");
					await interaction.editReply({ content: `Account ${userID} has been linked!`, ephemeral: true });
				} catch (error) {
					console.log("Account adding error!");
					await interaction.editReply({ content: `Account adding error`, ephemeral: true });
				}
				
				console.log("");	
				console.log("Starting monitoring!");
				console.log("");

				task.start();
			}
		}

	} else if(commandName === 'unlink') {
		
		var userID = interaction.options.getString('userid');

        if(isNaN(userID)) {
            await interaction.reply({ content: `That is not a valid ID!`, ephemeral: true });
            return;
        }

		PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
		PlayersDataText = JSON.parse(PlayersDataJSON);

		let userexists = false;
		if (PlayersDataText.length>0) { 
			for(var i = 0; i < PlayersDataText.length; i++) {	
				if(PlayersDataText[i].blUserID == userID) userexists = true;
			}	
		}

		if (!userexists) {
			await interaction.reply({ content: `Account with this ID not found!`, ephemeral: true });
			return;
		}

		await interaction.deferReply();
		await waitUntil(() => !working, { timeout : Infinity });

		console.log("");	
		console.log("Stop monitoring!");
		console.log("");

		task.stop();

		if (PlayersDataText.length>0) { 
			for(var i = 0; i < PlayersDataText.length; i++) {	
				if(PlayersDataText[i].blUserID == userID) {
					try {
						PlayersDataText.splice(i, 1);
						fs.writeFileSync('playersdata.json', JSON.stringify(PlayersDataText));
						console.log("Account " + userID + " has been unlinked!");
						await interaction.editReply({ content: `Account ${userID} has been unlinked!`, ephemeral: true });
					} catch (error) {
						console.log("Account unlink error!");
						await interaction.editReply({ content: `Account unlink error!`, ephemeral: true });
					}
				}	
			}
		}

		console.log("");	
		console.log("Starting monitoring!");
		console.log("");
		
		task.start();
			
	} else if(commandName === 'bsr') {

		var mapcode = interaction.options.getString('mapid');

		if (mapcode != undefined) {
			let REQ_CHANNEL_ID = interaction.channel.id;
			if (IsHex(mapcode)) {
				console.log("Map code received!");
				await DrawMap(mapcode, REQ_CHANNEL_ID);	
				await interaction.reply({ content: "!bsr "+ mapcode, ephemeral: false });
			} else {
				await interaction.reply({ content: 'Invalid map code!', ephemeral: true });
			}
		}
	}
}); 

async function DrawScore(userID) {	

	var scores = {
		playername: "",
		mapname: "",
		rank: "",
		pp: "",
		accuracy: "",
		difficulty: "",
		replayurl: "",
		mapper: "",
		mapcoverurl: "",
		avatar: "",
		mapurl: "",
		songauthor: "",
		subName: "",
		modifiers: ""};

	for(let key in scores) {
		scores[key] = "";
	}

	if(userID != undefined) {
		var cancelProcess = false;

		var weightnum;
		var ranknum;
		var post;
		
		let url = BLAPI_URL + "/player/" + userID;

		await fetch(url, { method: "GET" })
		.then((response) => {
			if (response.ok) {
				return response.json();
			} else {
				console.log("Error: " + response.status);
				cancelProcess = true;
			}
		})
		.then(async (json) => {	
			if (json != undefined) {
				try {					
					scores.playername = json.name;
					scores.avatar = json.avatar;
					console.log("Player : " + scores.playername);
				} catch (error) {
					console.log(error);
					cancelProcess = true;
				} 
			} else {
				console.log("Failed get JSON");
				console.log("");
				cancelProcess = true;
			}
		})
		.catch(error => console.log(error));

		if (!cancelProcess) {

			let url2 = BLAPI_URL + "/player/" + userID + "/scores?sortBy=date&count=10&stars_from=0.01&time_from=" + TimeFrom + "&time_to=" + TimeTo;

			await fetch(url2, { method: "GET" })
			.then((response) => {
				if (response.ok) {
					return response.json();
				} else {
					console.log("Error: " + response.status);
				}
			})
			.then(async (json) => {			
				if (json != undefined) {
					try {

						let check = json.data[0].rank; 
						
						for(var i = 0; i < json.data.length; i++) {

							scores.mapname = json.data[i].leaderboard.song.name;
							scores.songauthor = json.data[i].leaderboard.song.author;
							scores.rank = "#" + json.data[i].rank;
							scores.pp = rounded(json.data[i].pp) + " (" + rounded(json.data[i].pp * json.data[i].weight) + ")";
							scores.accuracy = rounded(json.data[i].accuracy * 100)+"%";
							scores.difficulty = json.data[i].leaderboard.difficulty.difficultyName;
							scores.replayurl = BLREPLAY_URL + "/?scoreId=" + json.data[i].id;
							scores.mapper = json.data[i].leaderboard.song.mapper;
							scores.mapcoverurl = json.data[i].leaderboard.song.coverImage;
							scores.mapurl = BEATLEADER_URL + "/leaderboard/global/" + json.data[i].leaderboard.id;
							scores.modifiers = json.data[i].modifiers;
							scores.subName = json.data[i].leaderboard.song.subName;

							weightnum = json.data[i].weight;
							ranknum = json.data[i].rank;

							console.log("Find score: " + scores.songauthor+ " - " + scores.mapname + " " + scores.subName);
							console.log("Analyzing...");

							post = false;
				
							if (ranknum <= POST_RANK_10) post = true;
							if (weightnum >= WEIGHT_TOP_8) post = true;
							if (ranknum <= POST_RANK_100 && weightnum >= WEIGHT_TOP_20) post = true;
							
							if (post) {
				
								console.log("Pepechad! Drawing card...")
						
								let url3 = BEATLEADER_URL + "/u/" + userID;
								if (scores.modifiers != "") scores.accuracy = scores.accuracy + " (" + scores.modifiers + ")";
				
									try {
										const fields = {
											Leaderboard: bold("Leaderboard:　") + 'BeatLeader',
											Rank: bold("Rank:　") + scores.rank,
											PP: bold("PP:　") + scores.pp,
											Accuracy: bold("Accuracy:　") + scores.accuracy,
											Difficulty: bold("Difficulty:　") + scores.difficulty,
											'Open replay': bold("Open replay:　") + `[Link](${scores.replayurl})`,
										};
										const EmbedCard = new EmbedBuilder()						
										.setColor(Colors.Yellow)
										.setTitle(scores.songauthor+ " - " + scores.mapname + " "+ scores.subName)
										.setURL(scores.mapurl)
										.setAuthor({ name: scores.playername, iconURL: scores.avatar, url: url3 })
										.setThumbnail(scores.mapcoverurl)
										.setFooter({ text: scores.mapper })
										.addFields({ name: '\u200B', value: Object.values(fields).join('\n'), inline: true })
				
										client.channels.fetch(SCORES_CHANNEL_ID)
										.then(channel=> channel.send({ embeds: [EmbedCard] }))
				
										console.log("Done!")
										console.log("");
				
									} catch (error) {
										console.log(error);
									} 
							} else {
								console.log("Not pepechad!"); 
								console.log("");
							}
						}
			
					} catch (error) {
						console.log("No new scores found");
						console.log("");
					}
				} else {
					console.log("Failed get JSON");
				}
			})
			.catch(error => console.log(error));
		} 	
	}
}

async function DrawMap(mapcode, REQ_CHANNEL_ID) {	

	var mapinfo = {
		id: "",
		mappername: "",
		bpm: "",
		duration: "",
		songName: "",
		songSubName: "",
		songAuthorName: "",
		levelAuthorName: "",
		upvotes: "",
		downvotes: "",
		score: "",
		downloadURL: "",
		mapurl: "",
		coverURL: "",
		tags: ""
	};

	for(let key in mapinfo) {
		mapinfo[key] = "";
	}

	if(mapcode != undefined) {
	
		let url = BSAPI_URL + "/maps/id/" + mapcode;

		await fetch(url, { method: "GET" })
		.then((response) => {
			if (response.ok) {
				return response.json();
			} else {
				console.log("Error: " + response.status);

				client.channels.fetch(REQ_CHANNEL_ID)
				.then(channel=> channel.send('Map not found!'))
			}
		})
		.then(async (json) => {	
			if (json != undefined) {

				let curated, ranked, verifiedMapper;
				try {	
					if(json.curator.name != undefined) curated = true;	
				} catch (error) {
					curated = false;
				} 

				let tagsexists;
				try {	
					if(json.tags[0] != undefined) tagsexists = true;	
				} catch (error) {
					tagsexists = false;
				} 

				try {		

					mapinfo.id = json.id;
					mapinfo.mappername = json.uploader.name;
					mapinfo.bpm = json.metadata.bpm;
					mapinfo.duration = formatTime(json.metadata.duration);
					mapinfo.songName = json.metadata.songName;
					mapinfo.songSubName = json.metadata.songSubName;
					mapinfo.songAuthorName = json.metadata.songAuthorName;
					mapinfo.levelAuthorName = json.metadata.levelAuthorName;
					mapinfo.upvotes = json.stats.upvotes;
					mapinfo.downvotes = json.stats.downvotes;
					mapinfo.score = rounded(json.stats.score * 100)+"%";;
					ranked = json.ranked;
					verifiedMapper = json.uploader.verifiedMapper;
					mapinfo.mapurl = BEATSAVER_URL + "/maps/" + mapinfo.id;

					for(var i = 0; i < json.versions.length; i++) {
						if (json.versions[i].state = "Published") {
							mapinfo.downloadURL = json.versions[i].downloadURL;
							mapinfo.coverURL = json.versions[i].coverURL;
						}
					}

					if (tagsexists) {
						if (json.tags.length == 0) {
							mapinfo.tags = json.tags[0];
						} else {
							mapinfo.tags = json.tags[0];
							for(var i = 1; i < json.tags.length; i++) {
								mapinfo.tags = mapinfo.tags + ", " + json.tags[i];
							}
						}
					} else mapinfo.tags="-";

					let mapcolor = Colors.Grey;
					
					if (verifiedMapper) mapcolor = Colors.Purple;
					if (curated) mapcolor = Colors.Green;
					if (ranked) mapcolor = Colors.Orange;

					console.log("Drawing map card...");

					try {

						let bslogo = BEATSAVER_URL + "/static/favicon/apple-touch-icon.png";
						const fields = {
							Mapper: bold("Mapper:　") + mapinfo.mappername + " (" + mapinfo.levelAuthorName + ")",
							'Song Length': bold("Song Length:　") + mapinfo.duration,
							BPM: bold("BPM:　") + mapinfo.bpm,
							Rating: bold("Rating:　") + mapinfo.upvotes + " / " + mapinfo.downvotes + " (" + mapinfo.score + ")",
							Tags: bold("Tags:　") + mapinfo.tags,
							Download: bold("Download:　") + `[Link](${mapinfo.downloadURL})`,
						};
						const EmbedCard = new EmbedBuilder()						
						.setColor(mapcolor)
						.setTitle(mapinfo.songAuthorName+ " - " + mapinfo.songName + " "+ mapinfo.songSubName)
						.setURL(mapinfo.mapurl)
						.setAuthor({ name: "BeatSaver", iconURL: bslogo, url: mapinfo.mapurl })
						.setThumbnail(mapinfo.coverURL)
						.addFields({ name: '\u200B', value: Object.values(fields).join('\n'), inline: true })

						client.channels.fetch(REQ_CHANNEL_ID)
						.then(channel=> channel.send({ embeds: [EmbedCard] }))

						console.log("Done!")
						console.log("");

					} catch (error) {
						console.log(error);
					} 
				} catch (error) {
					console.log(error);
				} 
			} else {
				console.log("Failed get JSON");
				console.log("");
			}
		})
		.catch(error => console.log(error));
	}
}

function addSeconds(date, seconds) {
	const dateCopy = new Date(date);
	dateCopy.setSeconds(date.getSeconds() + seconds);
	return dateCopy;
}

function bold(text) {
	return `**${text}**`;
}

function IsHex(str) {
	if (str.length>6) return false;
	for(var i = 0; i < str.length; i++) {
        if ((str[i]>'f')||
            (str[i]<'0')||
            ((str[i]>'9') && (str[i]<'A')) ||
            ((str[i]>'F') && (str[i]<'a'))) return false;
    }
    return true;
}

function formatTime(sec) {
    var hours   = Math.floor(sec / 3600);
    var minutes = Math.floor((sec - (hours * 3600)) / 60);
    var seconds = sec - (hours * 3600) - (minutes * 60);

    //if (hours   < 10) {hours   = "0"+hours;}
    //if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return minutes+':'+seconds;
}

var rounded = function(number){
    return +number.toFixed(2);
}