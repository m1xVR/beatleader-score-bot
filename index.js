const { Client, EmbedBuilder, GatewayIntentBits, Colors } = require('discord.js');
const config = require("./config.json");
const cron = require('node-cron');
const fs = require('fs');
const waitUntil = require('async-wait-until').waitUntil;

const AUTOSTART_MAIN_SCHEDULE = true;

const SCORES_CHANNEL_ID = config.channelId;
const BLAPI_URL = 'https://api.beatleader.com';
const BLREPLAY_URL = 'https://replay.beatleader.com';
const BEATLEADER_URL = 'https://beatleader.com';

const SSAPI_URL = 'https://scoresaber.com/api';
const SCORESABER_URL = 'https://scoresaber.com';

const ARC_VIEWER_URL = 'https://allpoland.github.io/ArcViewer';
const BSAPI_URL = 'https://api.beatsaver.com';
const BEATSAVER_URL = 'https://beatsaver.com';

const POST_RANK_10 = 10;
const POST_RANK_100 = 100;
const WEIGHT_TOP_8 = 0.77;
const WEIGHT_TOP_20 = 0.5;

// CIS TOP 100 players
const ENABLE_COUNTRY_RANKCHANGE_MON = true;
const RANK_TOP = 100;

const RANK_TOP_COUNTRIES_BL = "am%2Caz%2Cby%2Ckz%2Ckg%2Cmd%2Cru%2Ctj%2Cua%2Cuz%2Cee";
const RANK_TOP_COUNTRIES_SS = "AM%2CAZ%2CBY%2CKZ%2CKG%2CMD%2CRU%2CTJ%2CUA%2CUZ%2CEE";
const NAME_RANK_TOP_BL = 'BeatLeader CIS TOP';
const NAME_RANK_TOP_SS = 'ScoreSaber CIS TOP';

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

var task = cron.schedule("*/5 * * * *", async function () {

	working = true;
	
	NewCheck = new Date(Date.now());
	
	//LastCheck = new Date("2025-08-23T23:50:00"); // Задание своего промежутка для тестирования скоров
	//NewCheck  = new Date("2025-08-23T23:55:00");

	console.log("----------------------------------------------------------------");
	console.log("New Iteration");
	console.log("The search interval:");	
	console.log(DateTime(LastCheck));
	console.log(DateTime(NewCheck));
	console.log("");	
	
	TimeFrom = LastCheck.getTime()/ 1000 | 0;
	TimeTo = NewCheck.getTime()/ 1000 | 0;
	
	for (var i = 0; i < PlayersDataText.length; i++) {    
        console.log("Looking for scores for a player " + (i+1) + " of " + PlayersDataText.length + ": " + PlayersDataText[i].userID + " (" + PlayersDataText[i].platform + ")");
        if (PlayersDataText[i].platform === "BL") {
            await DrawScore(PlayersDataText[i].userID);    
        } else if (PlayersDataText[i].platform === "SS") {
            await DrawScoreOnSS(PlayersDataText[i].userID); // Новая функция для ScoreSaber
        }
    }
	
	LastCheck = addSeconds(NewCheck,1);

	if (rc_mon_flag) {
		
		console.log("");
		console.log("Start check for BL rank up!");
		await CheckRankChange_BL();
		
		console.log("Start check for SS rank up!");
		await CheckRankChange_SS();
		
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
        let NewFile = [{ userID: "76561198108258623", platform: "SS" }]; // Дефолт для ScoreSaber
        fs.writeFileSync('playersdata.json', JSON.stringify(NewFile));
    }
        
    PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
    PlayersDataText = JSON.parse(PlayersDataJSON);
    if (PlayersDataText.length > 0) { 
        console.log("Founded " + PlayersDataText.length + " players:");
        for (var i = 0; i < PlayersDataText.length; i++) {   
            console.log(`${PlayersDataText[i].userID} (${PlayersDataText[i].platform})`);
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
/*
try {
  let user = message.mentions.users.first();
  if ((user != undefined) && (user.id === config.clientId)) {
    let ebalo = "завали ебало";
    client.channels.fetch(REQ_CHANNEL_ID)
      .then(channel => channel.send(ebalo));
		let user = message.author;
    // Получаем объект GuildMember для упомянутого пользователя
    let member = message.guild.members.cache.get(user.id);
    if (member) {
      // Замените 'MUTED_ROLE_ID' на реальный ID роли Muted
      let mutedRole = message.guild.roles.cache.find(role => role.name === 'Muted');
      if (mutedRole) {
        // Добавляем роль Muted
        member.roles.add(mutedRole)
          .then(() => {
            console.log(`Роль Muted добавлена пользователю ${user.tag}`);

            // Удаляем роль через 10 минут
            setTimeout(() => {
              member.roles.remove(mutedRole)
                .then(() => console.log(`Роль Muted удалена у пользователя ${user.tag}`))
                .catch(err => console.error('Ошибка при удалении роли:', err));
            }, 1 * 60 * 1000); // 10 минут в миллисекундах
          })
          .catch(err => console.error('Ошибка при добавлении роли:', err));
      } else {
        console.error('Роль Muted не найдена');
      }
    } else {
      console.error('Пользователь не найден в guild members');
    }
  }
} catch (error) {
  console.error('Ошибка:', error);
}
*/

try {
    const user = message.mentions.users.first();
    if (user && user.id === config.clientId) {
        const replyMessage = "Завали ебало";
        message.channel.send(replyMessage)
            .then(() => console.log(`Ответил на пинг от ${message.author.tag}`))
            .catch(err => console.error('Ошибка при отправке сообщения:', err));
    }
} catch (error) {
    console.error('Ошибка при обработке пинга:', error);
}


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
        var platform = interaction.options.getString('platform'); // Требуется добавить опцию в slash-команду

        if (!userID || !platform || (platform !== "BL" && platform !== "SS")) {
            await interaction.reply({ content: `Invalid ID or platform! Use "BL" for BeatLeader or "SS" for ScoreSaber.`, ephemeral: true });
            cancelProcess = true;
        }

        if (!cancelProcess) {
            PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
            PlayersDataText = JSON.parse(PlayersDataJSON);

            if (PlayersDataText.length > 0) { 
                for (var i = 0; i < PlayersDataText.length; i++) {    
                    if (PlayersDataText[i].userID == userID && PlayersDataText[i].platform == platform) {
                        await interaction.reply({ content: `That account is already linked for ${platform}!`, ephemeral: true });
                        cancelProcess = true;
                        break;
                    }
                }    
            }

            if (!cancelProcess) {
                await interaction.deferReply();

                let url = platform === "BL" ? `${BLAPI_URL}/player/${userID}` : `${SSAPI_URL}/player/${userID}/full`;

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
                    if (json && json.name != undefined) {
                        console.log("Account found!");
                    } else {
                        throw new Error("No name in response");
                    }
                })
                .catch(async (error) => {
                    console.log("Account does not exist: " + error);
                    await interaction.editReply({ content: `Account does not exist on ${platform}!`, ephemeral: true });
                    console.log("");
                    cancelProcess = true;
                });

                if (!cancelProcess) {
                    await waitUntil(() => !working, { timeout: Infinity });

                    console.log("");    
                    console.log("Stop monitoring!");
                    console.log("");

                    task.stop();

                    var NewPlayer = { userID: userID, platform: platform };

                    try {
                        PlayersDataText.push(NewPlayer);
                        fs.writeFileSync('playersdata.json', JSON.stringify(PlayersDataText));
                        console.log(`Account ${userID} has been linked for ${platform}!`);
                        await interaction.editReply({ content: `Account ${userID} has been linked for ${platform}!`, ephemeral: true });
                    } catch (error) {
                        console.log("Account adding error: " + error);
                        await interaction.editReply({ content: `Account adding error`, ephemeral: true });
                    }
                    
                    console.log("");    
                    console.log("Start monitoring!");
                    console.log("");

                    task.start();
                }
            }
        }

	} else if (commandName === 'unlink') {
    const userID = interaction.options.getString('userid');
    const platform = interaction.options.getString('platform');

    // Проверка валидности входных данных
    if (!userID || !platform || !['BL', 'SS'].includes(platform)) {
        return await interaction.reply({ 
            content: 'Неверный ID или платформа! Используйте "BL" для BeatLeader или "SS" для ScoreSaber.', 
            ephemeral: true 
        });
    }

    // Чтение данных из файла
    let PlayersDataText;
    try {
        PlayersDataJSON = fs.readFileSync('playersdata.json', 'utf8');
        PlayersDataText = JSON.parse(PlayersDataJSON);
    } catch (error) {
        console.log('Ошибка чтения playersdata.json, создание пустого списка:', error);
        PlayersDataText = [];
    }

    // Поиск записи с учётом userID и platform
    let userExists = false;
    let userIndex = -1;
    if (PlayersDataText.length > 0) {
        for (let i = 0; i < PlayersDataText.length; i++) {
            if (PlayersDataText[i].userID === userID && PlayersDataText[i].platform === platform) {
                userExists = true;
                userIndex = i;
                break;
            }
        }
    }

    // Если запись не найдена
    if (!userExists) {
        await interaction.reply({ 
            content: `Аккаунт с ID ${userID} не найден для ${platform}!`, 
            ephemeral: true 
        });
        return;
    }

    // Отложенный ответ
    await interaction.deferReply({ ephemeral: true });

    // Ожидание завершения работы и остановка мониторинга
    await waitUntil(() => !working, { timeout: Infinity });
    console.log("");	
    console.log("Stop monitoring!");
    console.log("");
    task.stop();

    // Удаление записи
    try {
        PlayersDataText.splice(userIndex, 1);
        fs.writeFileSync('playersdata.json', JSON.stringify(PlayersDataText, null, 2));
        console.log(`Account ${userID} has been unlinked from ${platform}!`);
        await interaction.editReply({ 
            content: `Аккаунт ${userID} успешно отвязан от ${platform}!`, 
            ephemeral: true 
        });
    } catch (error) {
        console.log("Account unlink error:", error);
        await interaction.editReply({ 
            content: `Ошибка при отвязке аккаунта ${userID} от ${platform}!`, 
            ephemeral: true 
        });
    }

    // Возобновление мониторинга
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
		modifiers: "",
		stars: ""
	};

	for(let key in scores) {
		scores[key] = "";
	}

	if(userID != undefined) {
		var cancelProcess = false;
		
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
						
						for (var i = 0; i < json.data.length; i++) {

							var weightnum;
							var ranknum;
							var post;
							var ppnum;
							var fullCombo = false;
							var badCuts;
							var missedNotes;
							var bombCuts;
							var wallsHit;
							var headset;

							scores.mapname = json.data[i].leaderboard.song.name;
							scores.songauthor = json.data[i].leaderboard.song.author;
							scores.rank = "#" + json.data[i].rank;
							scores.pp = rounded(json.data[i].pp) + " (" + rounded(json.data[i].pp * json.data[i].weight) + ")";
							scores.accuracy = rounded(json.data[i].accuracy * 100)+"%";
							scores.difficulty = json.data[i].leaderboard.difficulty.difficultyName;
							scores.stars = rounded(json.data[i].leaderboard.difficulty.stars);
							scores.replayurl = BLREPLAY_URL + "/?scoreId=" + json.data[i].id;
							scores.replayurl2 = ARC_VIEWER_URL + "/?scoreID=" + json.data[i].id;
							scores.mapper = json.data[i].leaderboard.song.mapper;
							scores.mapcoverurl = json.data[i].leaderboard.song.coverImage;
							scores.mapurl = BEATLEADER_URL + "/leaderboard/global/" + json.data[i].leaderboard.id;
							scores.modifiers = json.data[i].modifiers;
							scores.subName = json.data[i].leaderboard.song.subName;

							fullCombo = json.data[i].fullCombo;

							badCuts = json.data[i].badCuts;
							missedNotes = json.data[i].missedNotes;
							bombCuts = json.data[i].bombCuts;
							wallsHit = json.data[i].wallsHit;

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

								headset = gethmd(json.data[i].hmd);
				
								try {
									if (fullCombo) {
										fields = {
											Leaderboard: bold("Leaderboard:　") + 'BeatLeader',
											Headset: bold("Headset:　") + headset,
											Rank: bold("Rank:　") + scores.rank,
											PP: bold("PP:　") + scores.pp,
											Stars: bold("Stars:　") + scores.stars + "★",
											Accuracy: bold("Accuracy:　") + scores.accuracy + " FC",
											Difficulty: bold("Difficulty:　") + scores.difficulty,
											'Open replay': bold("Open replay:　") + `[BeatLeader](${scores.replayurl})` + " or " + `[ArcViewer](${scores.replayurl2})`,
										};
									} else {

										var notFCreason = "";
										var nPref;

										if (badCuts > 0) notFCreason = bold("BadCuts:　") + badCuts;
										nPref = ((notFCreason === "") ? "" : "\n");
										if (missedNotes > 0) notFCreason = notFCreason + nPref + bold("MissedNotes:　") + missedNotes;
										nPref = ((notFCreason === "") ? "" : "\n");
										if (bombCuts > 0) notFCreason = notFCreason + nPref + bold("BombCuts:　") + bombCuts;
										nPref = ((notFCreason === "") ? "" : "\n");
										if (wallsHit > 0) notFCreason = notFCreason + nPref + bold("WallsHit:　") + wallsHit;

										fields = {
											Leaderboard: bold("Leaderboard:　") + 'BeatLeader',
											Headset: bold("Headset:　") + headset,
											Rank: bold("Rank:　") + scores.rank,
											PP: bold("PP:　") + scores.pp,
											Stars: bold("Stars:　") + scores.stars + "★",
											Accuracy: bold("Accuracy:　") + scores.accuracy,
											Difficulty: bold("Difficulty:　") + scores.difficulty,
											notFCreason,
											'Open replay': bold("Open replay:　") + `[BeatLeader](${scores.replayurl})` + " or " + `[ArcViewer](${scores.replayurl2})`,
										};
									}
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
						//console.log("No new scores found");
						//console.log("");
					}
				} else {
					console.log("Failed get JSON");
				}
			})
			.catch(error => console.log(error));
		} 	
	}
}

async function DrawScoreOnSS(userID) {

    var scores = {
        playername: "", mapname: "", rank: "", pp: "", accuracy: "", difficulty: "",
        mapcoverurl: "", avatar: "", mapurl: "", songauthor: "", subName: "", modifiers: "", mapper: "", stars: ""
    };
	
	let headset = "Unknown";

    for (let key in scores) {
        scores[key] = "";
    }

    if (userID != undefined) {
        let cancelProcess = false;
		
		let url = SSAPI_URL + `/player/${userID}/full`;
		
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
                    scores.avatar = json.profilePicture;
					headset = gethmd(json.deviceHmd);
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
			let url2 = SSAPI_URL + `/player/${userID}/scores?limit=10&sort=recent`;
			
            await fetch(url2, { method: "GET" })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                } else {
                    console.log("Error: " + response.status);
                }
            })
            .then(async (json) => {            
                if (json != undefined && json.playerScores) {
                    try {
                        let check = json.playerScores[0].score.rank; 
                        
                        for (var i = 0; i < json.playerScores.length; i++) {
                            var weightnum;
                            var ranknum;
                            var post;
                            var ppnum;
                            var fullCombo = false;
							
                            const leaderboard = json.playerScores[i].leaderboard;
                            const score = json.playerScores[i].score;
							
							// Фильтрация по времени
							
                                const scoreTime = new Date(score.timeSet).getTime() / 1000; // Время скора в секундах
                                if (scoreTime < TimeFrom || scoreTime > TimeTo) {
                                    //console.log(`Score ${scores.songauthor} - ${scores.mapname} outside time range (${score.timeSet})`);
                                    continue; // Пропускаем скор, если он вне диапазона
                                }
								
								// Фильтрация только рейтинговых карт (pp > 0)
                                const ppValue = score.pp || 0;
                                if (ppValue <= 0) {
                                    //console.log(`Score ${leaderboard.songAuthorName} - ${leaderboard.songName} is not ranked (pp: ${ppValue})`);
                                    continue;
                                }

                            scores.mapname = leaderboard.songName;
                            scores.songauthor = leaderboard.songAuthorName;
                            scores.rank = "#" + score.rank;
                            scores.pp = rounded(score.pp) + " (" + rounded(score.pp * score.weight) + ")";
                            scores.accuracy = rounded((score.baseScore / leaderboard.maxScore) * 100) + "%";
                            scores.difficulty = getDifficultyName(leaderboard.difficulty.difficulty);
							scores.stars = rounded(leaderboard.stars);
                            scores.mapcoverurl = leaderboard.coverImage;
							scores.mapurl = SCORESABER_URL + `/leaderboard/${leaderboard.id}`;
                            scores.subName = leaderboard.songSubName;
                            scores.modifiers = score.modifiers || "";
							scores.mapper = leaderboard.levelAuthorName;
							
							const headset = score.deviceHmd !== undefined && score.deviceHmd !== null ? gethmd(score.deviceHmd) : "Unknown"; // Извлекаем для каждого скора
                            //console.log("Raw deviceHmd value: " + score.deviceHmd);

                            weightnum = score.weight || 0;
                            ranknum = score.rank;
                            ppnum = score.pp;

                            console.log("Find score: " + scores.songauthor + " - " + scores.mapname + " " + scores.subName);
                            console.log("Analyzing...");

                            post = false;
                            if (ranknum <= POST_RANK_10 && ppnum > 0) post = true;
                            if (weightnum >= WEIGHT_TOP_8) post = true;
                            if (ranknum <= POST_RANK_100 && weightnum >= WEIGHT_TOP_20) post = true;
                            
                            if (post) {
                                console.log("Pepechad! Drawing card...");

                                let embedcolor = '#ffaa00';
								
								let url3 = SCORESABER_URL + `/u/${userID}`;
                                
                                if (scores.modifiers != "") scores.accuracy = scores.accuracy + " (" + scores.modifiers + ")";
								
								fullCombo = score.fullCombo;
								const badCuts = score.badCuts;
								const missedNotes = score.missedNotes;

                                try {
                                    let fields;
                                    if (fullCombo === true) {
                                        fields = {
                                            Leaderboard: bold("Leaderboard:　") + 'ScoreSaber',
											Headset: bold("Headset:　") + score.deviceHmd,
                                            Rank: bold("Rank:　") + scores.rank,
                                            PP: bold("PP:　") + scores.pp,
											Stars: bold("Stars:　") + scores.stars + "★",
                                            Accuracy: bold("Accuracy:　") + scores.accuracy + " FC",
                                            Difficulty: bold("Difficulty:　") + scores.difficulty,
                                        };
                                    } else {
                                        fields = {
                                            Leaderboard: bold("Leaderboard:　") + 'ScoreSaber',
											Headset: bold("Headset:　") + score.deviceHmd,
                                            Rank: bold("Rank:　") + scores.rank,
                                            PP: bold("PP:　") + scores.pp,
											Stars: bold("Stars:　") + scores.stars + "★",
                                            Accuracy: bold("Accuracy:　") + scores.accuracy,
                                            Difficulty: bold("Difficulty:　") + scores.difficulty,
											BadCuts: bold("Bad Cuts:　") + badCuts,
											MissedNotes: bold("Missed Notes:　") + missedNotes,
                                        };
                                    }

                                    const EmbedCard = new EmbedBuilder()                        
                                        .setColor(embedcolor)
                                        .setTitle(scores.songauthor + " - " + scores.mapname + " " + scores.subName)
                                        .setURL(scores.mapurl)
                                        .setAuthor({ name: scores.playername, iconURL: scores.avatar, url: url3 })
                                        .setThumbnail(scores.mapcoverurl)
										.setFooter({ text: scores.mapper })
                                        .addFields({ name: '\u200B', value: Object.values(fields).join('\n'), inline: true });
                
                                    client.channels.fetch(SCORES_CHANNEL_ID)
                                        .then(channel => channel.send({ embeds: [EmbedCard] }));
                
                                    console.log("Done!");
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
                        //console.log("No new scores found");
                        //console.log("");
                    }
                } else {
                    console.log("Failed get JSON");
                }
            })
            .catch(error => console.log(error));
        }    
    }
}

function getDifficultyName(difficulty) {
    switch (difficulty) {
        case 1: return "Easy";
        case 3: return "Normal";
        case 5: return "Hard";
        case 7: return "Expert";
        case 9: return "Expert+";
        default: return "Unknown";
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

async function CheckRankChange_BL() {	
		
		let url = BLAPI_URL + "/players?sortBy=pp&count=" + RANK_TOP + "&countries=" + RANK_TOP_COUNTRIES_BL + "&mapsType=ranked&ppType=general&friends=false";

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

					new_scorerank.length = 0;
					old_scorerank.length = 0;						

					for(var i = 0; i < json.data.length; i++) {
						new_scorerank.push([ i, json.data[i].name, json.data[i].id, json.data[i].avatar, json.data[i].country , json.data[i].pp, json.data[i].rank, json.data[i].countryRank ]);
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

										let cislink = BEATLEADER_URL + "/ranking/1?countries=" + RANK_TOP_COUNTRIES_BL + "&sortBy=pp&order=desc&mapsType=ranked&ppType=general";

										// BB chars for fixbbcode: _ * | ` > - ~

										if (new_scorerank[y][0] === 0) {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP_BL + RANK_TOP,
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "Rank:　🌎 #" + new_scorerank[y][6] + "　" + countrytoemoji(new_scorerank[y][4]) + " #"+ new_scorerank[y][7],
												4: "PP:　" + rounded(new_scorerank[y][5]),
												5: "```",
												7: "#" + (new_scorerank[y][0]+1) + " " + (countrytoemoji(new_scorerank[y][4])) + " " + fixbbcode(new_scorerank[y][1]) + " " + rounded(new_scorerank[y][5]) + "↑",
												8: "#" + (new_scorerank[y+1][0]+1) + " " + (countrytoemoji(new_scorerank[y+1][4])) + " " + fixbbcode(new_scorerank[y+1][1]) + " " + rounded(new_scorerank[y+1][5]) + "↓",
												9: "```",
											};
										} else {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP_BL + RANK_TOP,
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "Rank:　🌎 #" + new_scorerank[y][6] + "　" + countrytoemoji(new_scorerank[y][4]) + " #"+ new_scorerank[y][7],
												4: "PP:　" + rounded(new_scorerank[y][5]),
												5: "```",
												6: "#" + (new_scorerank[y-1][0]+1) + " " + (countrytoemoji(new_scorerank[y-1][4])) + " " + fixbbcode(new_scorerank[y-1][1]) + " " + rounded(new_scorerank[y-1][5]),
												7: "#" + (new_scorerank[y][0]+1) + " " + (countrytoemoji(new_scorerank[y][4])) + " " + fixbbcode(new_scorerank[y][1]) + " " + rounded(new_scorerank[y][5]) + "↑",
												8: "#" + (new_scorerank[y+1][0]+1) + " " + (countrytoemoji(new_scorerank[y+1][4])) + " " + fixbbcode(new_scorerank[y+1][1]) + " " + rounded(new_scorerank[y+1][5]) + "↓",
												9: "```",
											};
										}

										const EmbedCard = new EmbedBuilder()						
										.setColor(0x5f0c5a)
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

async function CheckRankChange_SS() {	// Новая функция для поиска изменений ранка по СНГ на СС 
	
		let url = SSAPI_URL + "/players?countries=" + RANK_TOP_COUNTRIES_SS;

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

					new_scorerank.length = 0;
					old_scorerank.length = 0;
				
					for(var i = 0; i < json.players.length; i++) {
						new_scorerank.push([ i, json.players[i].name, json.players[i].id, json.players[i].profilePicture, json.players[i].country , json.players[i].pp, json.players[i].rank, json.players[i].countryRank ]);
					}

					try {
						let loadrank = fs.readFileSync('rankdataSS.json', 'utf8');
						old_scorerank = JSON.parse(loadrank);
					} catch (error) {
						console.log("rankdataSS.json not found... create new");
						old_scorerank = new_scorerank;
						fs.writeFileSync('rankdataSS.json', JSON.stringify(old_scorerank));
					}

					if (old_scorerank.length > 0) {
						for(var x = 0; x < old_scorerank.length; x++) {
							for(var y = 0; y < new_scorerank.length; y++) {
								if ((old_scorerank[x][2] === new_scorerank[y][2]) && (old_scorerank[x][0] > new_scorerank[y][0]) && (old_scorerank[x][5] < new_scorerank[y][5])) {

									try {

										console.log(new_scorerank[y][1] + ": " + old_scorerank[x][0] + " -> " + new_scorerank[y][0]);

										let playerlogo = new_scorerank[y][3];

										let cislink = SCORESABER_URL + "/rankings?countries=" + RANK_TOP_COUNTRIES_SS;

										// BB chars for fixbbcode: _ * | ` > - ~

										if (new_scorerank[y][0] === 0) {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP_SS + "50",
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "Rank:　🌎 #" + new_scorerank[y][6] + "　" + countrytoemoji(new_scorerank[y][4]) + " #"+ new_scorerank[y][7],
												4: "PP:　" + rounded(new_scorerank[y][5]),
												5: "```",
												7: "#" + (new_scorerank[y][0]+1) + " " + (countrytoemoji(new_scorerank[y][4])) + " " + fixbbcode(new_scorerank[y][1]) + " " + rounded(new_scorerank[y][5]) + "↑",
												8: "#" + (new_scorerank[y+1][0]+1) + " " + (countrytoemoji(new_scorerank[y+1][4])) + " " + fixbbcode(new_scorerank[y+1][1]) + " " + rounded(new_scorerank[y+1][5]) + "↓",
												9: "```",
											};
										} else {
											var fields = {
												1: "Leaderboard:　" + NAME_RANK_TOP_SS + "50",
												2: "Player:　" + fixbbcode(new_scorerank[y][1]),
												3: "Rank:　🌎 #" + new_scorerank[y][6] + "　" + countrytoemoji(new_scorerank[y][4]) + " #"+ new_scorerank[y][7],
												4: "PP:　" + rounded(new_scorerank[y][5]),
												5: "```",
												6: "#" + (new_scorerank[y-1][0]+1) + " " + (countrytoemoji(new_scorerank[y-1][4])) + " " + fixbbcode(new_scorerank[y-1][1]) + " " + rounded(new_scorerank[y-1][5]),
												7: "#" + (new_scorerank[y][0]+1) + " " + (countrytoemoji(new_scorerank[y][4])) + " " + fixbbcode(new_scorerank[y][1]) + " " + rounded(new_scorerank[y][5]) + "↑",
												8: "#" + (new_scorerank[y+1][0]+1) + " " + (countrytoemoji(new_scorerank[y+1][4])) + " " + fixbbcode(new_scorerank[y+1][1]) + " " + rounded(new_scorerank[y+1][5]) + "↓",
												9: "```",
											};
										}

										const EmbedCard = new EmbedBuilder()						
										.setColor(0x8B4513)
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
						fs.writeFileSync('rankdataSS.json', JSON.stringify(new_scorerank));
					} catch (error) {
						console.log("rankdataSS.json save error!");
					}
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
    return number.toFixed(2);
}

function getRandomInt(max) {
	return Math.floor(Math.random() * max);
}

function DateTime(date) {
	return date.toLocaleDateString() + " " + date.toLocaleTimeString();
}

function fixbbcode(str) {
	return str.replaceAll('*',' ').replaceAll('_',' ').replaceAll('|',' ').replaceAll('-',' ').replaceAll('>',' ').replaceAll('<',' ').replaceAll('~',' ').replaceAll('`',' ');
}

function gethmd(hmd) {
	switch (hmd) {
		case 1:	return "Rift CV1";
		case 2:	return "Vive";
		case 4:	return "Vive Pro";
		case 8:	return "Windows Mixed Reality";
		case 16: return "Rift S";
		case 32: return "Quest";	
		case 33: return "Pico Neo 3";
		case 34: return "Pico Neo 2";	
		case 35: return "Vive Pro 2";
		case 36: return "Vive Elite";
		case 38: return "Pimax 8K";									
		case 39: return "Pimax 5K";	
		case 40: return "Pimax Artisan";
		case 41: return "HP Reverb";	
		case 42: return "Samsung WMR";	
		case 45: return "Lenovo Explorer";
		case 46: return "Acer WMR";
		case 47: return "Vive Focus";
		case 53: return "Varjo";
		case 60: return "Pico 4";
		case 61: return "Quest Pro";
		case 64: return "Valve Index with Knuckles";
		case 66: return "Bigscreen Beyond";
		case 69: return "Varjo Aero";
		case 128: return "Vive Cosmos";
		case 256: return "Quest 2";
		case 512: return "Quest 3";
		default: return "Unknown headset";
	}
}

function countrytoemoji(country) {
	var temp = country.toUpperCase();
	switch (temp) {
		case 'AM': return "🇦🇲";
		case 'AZ': return "🇦🇿";
		case 'BY': return "🇧🇾";
		case 'KG': return "🇰🇬";
		case 'KZ': return "🇰🇿";
		case 'MD': return "🇲🇩";
		case 'RU': return "🇷🇺";
		case 'TJ': return "🇹🇯";
		case 'UA': return "🇺🇦";
		case 'UZ': return "🇺🇿";
		case 'EE': return "🇪🇪";
		case 'TM': return "🇹🇲";
		default: return temp;
	}
}