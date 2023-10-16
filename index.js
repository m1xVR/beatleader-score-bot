const { Client, EmbedBuilder, GatewayIntentBits, Colors } = require('discord.js');
const config = require("./config.json");
const cron = require('node-cron');
const fs = require('fs');
const waitUntil = require('async-wait-until').waitUntil;

const AUTOSTART_MAIN_SCHEDULE = true;

const SCORES_CHANNEL_ID = config.channelId;
const BLAPI_URL = 'https://api.beatleader.xyz';
const BLREPLAY_URL = 'https://replay.beatleader.xyz';
const BEATLEADER_URL = 'https://www.beatleader.xyz';
const ARC_VIEWER_URL = 'https://allpoland.github.io/ArcViewer';
const BSAPI_URL = 'https://api.beatsaver.com';
const BEATSAVER_URL = 'https://beatsaver.com';

const POST_RANK_10 = 10;
const POST_RANK_100 = 100;
const WEIGHT_TOP_8 = 0.77;
const WEIGHT_TOP_20 = 0.5;

// CIS TOP 50 players
const ENABLE_COUNTRY_RANKCHANGE_MON = false;
const RANK_TOP = 50;
const RANK_TOP_COUNTRIES = "AM%2CAZ%2CBY%2CKG%2CKZ%2CMD%2CRU%2CTJ%2CUA%2CUZ";
const NAME_RANK_TOP = 'BeatLeader CIS TOP';

// !bsr [mapid]
const ENABLE_BSR_COMMAND = true;

var new_scorerank = [];
var old_scorerank = [];

var TimeFrom;
var TimeTo;

var LastCheck;
var NewCheck;

var PlayersDataText = {};
var PlayersDataJSON;

var working = false;
var rc_mon_flag = false;

var task = cron.schedule("*/2 * * * *", async function () {

	working = true;
	
	NewCheck = new Date(Date.now());

	console.log("----------------------------------------------------------------");
	console.log("New Iteration");
	console.log("The search interval:");	
	console.log(DateTime(LastCheck));
	console.log(DateTime(NewCheck));
	console.log("");	
	
	TimeFrom = LastCheck.getTime()/ 1000 | 0;
	TimeTo = NewCheck.getTime()/ 1000 | 0;
	
	for(var i = 0; i < PlayersDataText.length; i++) {	
		console.log("Looking for scores for a player " + (i+1) + " of " + PlayersDataText.length + ": " + PlayersDataText[i].blUserID);
		await DrawScore(PlayersDataText[i].blUserID);	
	}
	
	LastCheck = addSeconds(NewCheck,1);

	if (rc_mon_flag) {
		console.log("Start check for rank up!");
		await CheckRankChange();
		console.log("End check for rank up!");
		console.log("");
		rc_mon_flag = false;
	}
	
	console.log("End Iteration");
	console.log("----------------------------------------------------------------");
	console.log("");

	working = false;

}, {
	scheduled: false,
	timezone: "Europe/Minsk"
});

var task2 = cron.schedule("*/10 * * * *", async function () {
	rc_mon_flag = true;
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
	console.log("Start working at " + DateTime(LastCheck));
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

	console.log("");

	if (AUTOSTART_MAIN_SCHEDULE) {
		console.log("Start monitoring!");
		task.start();

			if (ENABLE_COUNTRY_RANKCHANGE_MON) {
				console.log("Start country rank change monitoring!");
				rc_mon_flag = true;
				task2.start();
			} else {
				console.log("Country rank change monitoring disabled!");
			}

	} else {
		console.log("Monitoring disabled!");
	}
	
	console.log("");

});

const prefix = "!";

client.on("messageCreate", async function(message) {

	var mapcode = ""; 

	const commandBody = message.content.slice(prefix.length);
	const args = commandBody.split(' ');
	const command = args.shift().toLowerCase();

	if (message.author.bot) return;

	let REQ_CHANNEL_ID = message.channel.id;

	// chat bot response when it receives a ping
	// try 
	// {
	// 	let user = message.mentions.users.first();
	// 	if ((user != undefined) && (user.id === config.clientId)) {
	// 		let emoji = [ ":heart:", ":broken_heart:"];
	// 		client.channels.fetch(REQ_CHANNEL_ID)
	// 		.then(channel=> channel.send("<@" + message.author.id + ">, " + emoji[getRandomInt(2)]));
	// 	}
	// } catch (error) {
	// 	console.log("Something happend!");
	// }

	if (!message.content.startsWith(prefix)) return;

	if  (ENABLE_BSR_COMMAND) {
		if ((command === "bsr") || (command === "map")) {
			mapcode = args[0];
			if (mapcode != undefined) {
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
				console.log("Start monitoring!");
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
		console.log("Start monitoring!");
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
		replayurl2: "",
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
		var ppnum;
		
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
							scores.replayurl2 = ARC_VIEWER_URL + "/?scoreID=" + json.data[i].id;
							scores.mapper = json.data[i].leaderboard.song.mapper;
							scores.mapcoverurl = json.data[i].leaderboard.song.coverImage;
							scores.mapurl = BEATLEADER_URL + "/leaderboard/global/" + json.data[i].leaderboard.id;
							scores.modifiers = json.data[i].modifiers;
							scores.subName = json.data[i].leaderboard.song.subName;

							weightnum = json.data[i].weight;
							ranknum = json.data[i].rank;
							ppnum = json.data[i].pp;

							console.log("Find score: " + scores.songauthor+ " - " + scores.mapname + " " + scores.subName);
							console.log("Analyzing...");

							post = false;
				
							if (ranknum <= POST_RANK_10 && ppnum > 0) post = true;
							if (weightnum >= WEIGHT_TOP_8) post = true;
							if (ranknum <= POST_RANK_100 && weightnum >= WEIGHT_TOP_20) post = true;
							
							if (post) {
				
								console.log("Pepechad! Drawing card...")

								let embedcolor = '#aa28aa';					
								let url3 = BEATLEADER_URL + "/u/" + userID;
								
								if (scores.modifiers != "") scores.accuracy = scores.accuracy + " (" + scores.modifiers + ")";
				
									try {
										const fields = {
											Leaderboard: bold("Leaderboard:　") + 'BeatLeader',
											Rank: bold("Rank:　") + scores.rank,
											PP: bold("PP:　") + scores.pp,
											Accuracy: bold("Accuracy:　") + scores.accuracy,
											Difficulty: bold("Difficulty:　") + scores.difficulty,
											'Open replay': bold("Open replay:　") + `[BeatLeader](${scores.replayurl})` + " or " + `[ArcViewer](${scores.replayurl2})`,
										};
										const EmbedCard = new EmbedBuilder()						
										.setColor(embedcolor)
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

async function CheckRankChange() {	
		
		let url = BLAPI_URL + "/players?sortBy=pp&count=" + RANK_TOP + "&countries=" + RANK_TOP_COUNTRIES + "&mapsType=ranked&ppType=general&friends=false";

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

					for(var i = 0; i < json.data.length; i++) {
						new_scorerank.push([ i, json.data[i].name, json.data[i].id, json.data[i].avatar, json.data[i].country , json.data[i].pp]);
					}

					try {
						let loadrank = fs.readFileSync('rankdata.json', 'utf8');
						old_scorerank = JSON.parse(loadrank);
					} catch (error) {
						console.log("rankdata.json not found... create new");
						old_scorerank = new_scorerank;
						fs.writeFileSync('rankdata.json', JSON.stringify(old_scorerank));
					}

					if (old_scorerank.length > 0) {
						for(var x = 0; x < old_scorerank.length; x++) {
							for(var y = 0; y < new_scorerank.length; y++) {
								if ((old_scorerank[x][2] === new_scorerank[y][2]) && (old_scorerank[x][0] > new_scorerank[y][0]) && (old_scorerank[x][5] < new_scorerank[y][5])) {

									try {

										console.log(new_scorerank[y][1] + ": " + old_scorerank[x][0] + " -> " + new_scorerank[y][0]);

										let playerlogo = new_scorerank[y][3];

										let cislink = BEATLEADER_URL + "/ranking/1?countries=" + RANK_TOP_COUNTRIES+ "&sortBy=pp&order=desc&mapsType=ranked&ppType=general";

										const chars = {
											'_': '',
											'*': '',
											'|': '',
											'`': '',
											'>': '',
											'-': '',
											'~': '',
										};

										if (new_scorerank[y][0] === 0) {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP + RANK_TOP,
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "PP:　" + rounded(new_scorerank[y][5]),
												4: "```",
												6: "#" + (new_scorerank[y][0]+1) + "　" + new_scorerank[y][4] + "　" + fixbbcode(new_scorerank[y][1]) + "　" + rounded(new_scorerank[y][5]) + " ↑",
												7: "#" + (new_scorerank[y+1][0]+1) + "　" + new_scorerank[y+1][4] + "　" + fixbbcode(new_scorerank[y+1][1]) + "　" + rounded(new_scorerank[y+1][5]) + " ↓",
												8: "```",
											};
										} else {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP + RANK_TOP,
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "PP:　" + rounded(new_scorerank[y][5]),
												4: "```",
												5: "#" + (new_scorerank[y-1][0]+1) + "　" + new_scorerank[y-1][4] + "　" + fixbbcode(new_scorerank[y-1][1]) + "　" + rounded(new_scorerank[y-1][5]),
												6: "#" + (new_scorerank[y][0]+1) + "　" + new_scorerank[y][4] + "　" + fixbbcode(new_scorerank[y][1]) + "　" + rounded(new_scorerank[y][5]) + " ↑",
												7: "#" + (new_scorerank[y+1][0]+1) + "　" + new_scorerank[y+1][4] + "　" + fixbbcode(new_scorerank[y+1][1]) + "　" + rounded(new_scorerank[y+1][5]) + " ↓",
												8: "```",
											};
										}

										const EmbedCard = new EmbedBuilder()						
										.setColor(Colors.DarkNavy)
										.setTitle("Player ranking change")
										.setURL(cislink)
										.setThumbnail(playerlogo)
										.addFields({ name: " ", value: Object.values(fields).join('\n'), inline: true })

										client.channels.fetch(SCORES_CHANNEL_ID)
										.then(channel=> channel.send({ embeds: [EmbedCard] }))
										
									} catch (error) {
										console.log(error);
									} 
								}
							}
						}
					}

					try {
						fs.writeFileSync('rankdata.json', JSON.stringify(new_scorerank));
					} catch (error) {
						console.log("rankdata.json save error!");
					}

					new_scorerank = [];

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
	var time;

    //if (hours   < 10) {hours   = "0"+hours;}
    //if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}

	if (hours > 0) time = hours+':'+minutes+':'+seconds
	else time = minutes+':'+seconds;

    return time;
}

var rounded = function(number){
    return +number.toFixed(2);
}

function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

function DateTime(date) {
	return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function fixbbcode(str) {
	return str.replaceAll('*',' ').replaceAll('_',' ').replaceAll('|',' ').replaceAll('-',' ').replaceAll('>',' ').replaceAll('~',' ').replaceAll('`',' ');
}
