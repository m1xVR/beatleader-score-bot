const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { clientId, guildId, BOT_TOKEN } = require('./config.json');

const commands = [
	new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link a new BeatLeader player to scores tracking')
        .addStringOption(option => 
            option.setName('userid')
            .setDescription('The User ID of BeatLeader player.')
            .setRequired(true)),
    new SlashCommandBuilder()
        .setName('unlink')
        .setDescription('Unink BeatLeader player from tracking scores')
		.addStringOption(option => 
            option.setName('userid')
            .setDescription('The User ID of BeatLeader player.')
            .setRequired(true)),
	new SlashCommandBuilder()
	.setName('bsr')
	.setDescription('Show details from a BeatSaber map')
	.addStringOption(option => 
		option.setName('mapid')
		.setDescription('The ID of BeatSaber map.')
		.setRequired(true)),
]
	.map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(BOT_TOKEN);

rest.put(Routes.applicationCommands(clientId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);