import dotenv from 'dotenv'
dotenv.config()

import * as database from './db'
import * as privateBot from './bot_private'
import * as afx from './global'
import * as utils from './utils'

import TelegramBot from 'node-telegram-bot-api'

export const COMMAND_START = 'start'

export enum OptionCode {
	BACK = -100,
	CLOSE,
	TITLE,
	WELCOME = 0,
	MAIN_MENU,
	CREATE_TOKEN,
	CREATE_OPENBOOK_MARKET,
	WALLET_TOKEN_CREATE_CONFIRM,
	OPEBBOOK_CREATE_CONFIRM,
	MAIN_MYGAMES,
	MAIN_GAMES,
	MAIN_HELP,
	MAIN_WALLET,
	MAIN_REFERRAL,
	MAIN_REFRESH,
	MAIN_WALLET_SIGN,
	WALLET_DEPOSIT_SOL,
	WALLET_DEPOSIT_TOKEN,
	WALLET_WITHDRAW_ALL,
	WALLET_WITHDRAW_X_SOL,
	WALLET_WITHDRAW_X_TOKEN,
	WALLET_WITHDRAW_CONFIRM,
	WALLET_RESET_WALLET,
	WALLET_EXPORT_KEY,
	WALLET_REFRESH,
	WALLET_RESET_WALLET_CONFIRM,
	WALLET_IMPORT_KEY,
	WALLET_IMPORT_KEY_CONFIRM,
	WALLET_EXPORT_KEY_CONFIRM,

	GAME_CREATE,
	GAME_DETAIL,
	GAME_BETTING_UP,
	GAME_BETTING_DOWN,
	GAME_PREV,
	GAME_NEXT,
	GAME_NEW_CONFIRM,
	MONITOR_DEPOSIT,
}

export enum StateCode {
	IDLE = 1000,
	WAIT_SET_WALLET_WITHDRAW_ADDRESS,
	WAIT_SET_WALLET_WITHDRAW_AMOUNT,
	WAIT_SET_NEW_GAME_DESC,
	WAIT_SET_TOKEN_DECIMAL,
	OPENBOOK_SET_QUOTE_ADDRESS,
	WAIT_SET_NEW_TOKEN_METADATA_URL,
	OPENBOOK_SET_MINIMUM_ORDER_SIZE,
	WAIT_SET_NEW_TOTAL_SUPPLY,
	OPENBOOK_SET_MINIMUM_PRICE_TICKET_SIZE,
	WAIT_SET_NEW_TOKEN_CONFIRM,
	WAIT_SET_WALLET_DEPOSIT_PAYER_ADDRESS,
	WAIT_SET_WALLET_DEPOSIT_X_AMOUNT,
	WAIT_SET_WALLET_IMPORT_PKEY,
	WAIT_SET_TOKEN_NAME,
	OPENBOOK_SET_TOKEN_ADDRESS
}

export let bot: TelegramBot
export let myInfo: TelegramBot.User
export const sessions = new Map()
export const stateMap = new Map()

export const stateMap_setFocus = (chatid: string, state: any, data: any = {}) => {

	let item = stateMap.get(chatid)
	if (!item) {
		item = stateMap_init(chatid)
	}

	if (!data) {
		let focusData = {}
		if (item.focus && item.focus.data) {
			focusData = item.focus.data
		}

		item.focus = { state, data: focusData }
	} else {
		item.focus = { state, data }
	}

	stateMap.set(chatid, item)
}

export const stateMap_getFocus = (chatid: string) => {
	const item = stateMap.get(chatid)
	if (item) {
		let focusItem = item.focus
		return focusItem
	}

	return null
}

export const stateMap_init = (chatid: string) => {

	let item = {
		focus: { state: StateCode.IDLE, data: { sessionId: chatid } },
		message: new Map()
	}

	stateMap.set(chatid, item)

	return item
}

export const stateMap_setMessage_Id = (chatid: string, messageType: number, messageId: number) => {

	let item = stateMap.get(chatid)
	if (!item) {
		item = stateMap_init(chatid)
	}

	item.message.set(`t${messageType}`, messageId)
	//stateMap.set(chatid, item)
}

export const stateMap_getMessage = (chatid: string) => {
	const item = stateMap.get(chatid)
	if (item) {
		let messageItem = item.message
		return messageItem
	}

	return null
}

export const stateMap_getMessage_Id = (chatid: string, messageType: number) => {
	const messageItem = stateMap_getMessage(chatid)
	if (messageItem) {

		return messageItem.get(`t${messageType}`)
	}

	return null
}

export const stateMap_get = (chatid: string) => {
	return stateMap.get(chatid)
}

export const stateMap_remove = (chatid: string) => {
	stateMap.delete(chatid)
}

export const stateMap_clear = () => {
	stateMap.clear()
}

const json_buttonItem = (key: string, cmd: number, text: string) => {
	return {
		text: text,
		callback_data: JSON.stringify({ k: key, c: cmd }),
	}
}

const json_url_buttonItem = (text: string, url: string) => {
	return {
		text: text,
		url: url,
	}
}

const json_webapp_buttonItem = (text: string, url: any) => {
	return {
		text: text,
		web_app: {
			url
		}
	}
}

export const removeMenu = async (chatId: string, messageType: number) => {

	const msgId = stateMap_getMessage_Id(chatId, messageType)

	if (msgId) {

		try {

			await bot.deleteMessage(chatId, msgId)

		} catch (error) {
			//afx.errorLog('deleteMessage', error)
		}
	}
}

export const openMenu = async (chatId: string, messageType: number, menuTitle: string, json_buttons: any = []) => {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	return new Promise(async (resolve, reject) => {

		await removeMenu(chatId, messageType)

		try {

			let msg: TelegramBot.Message = await bot.sendMessage(chatId, menuTitle, { reply_markup: keyboard, parse_mode: 'HTML', disable_web_page_preview: true });

			stateMap_setMessage_Id(chatId, messageType, msg.message_id)
			// console.log('chatId, messageType, msg.message_id', chatId, messageType, msg.message_id)
			resolve({ messageId: msg.message_id, chatid: msg.chat.id })

		} catch (error) {
			afx.errorLog('openMenu', error)
			resolve(null)
		}
	})
}

export const openMessage = async (chatId: string, bannerId: string, messageType: number, menuTitle: string) => {

	return new Promise(async (resolve, reject) => {

		await removeMenu(chatId, messageType)

		let msg: TelegramBot.Message

		try {

			if (bannerId) {

				msg = await bot.sendPhoto(chatId, bannerId, { caption: menuTitle, parse_mode: 'HTML' });

			} else {

				msg = await bot.sendMessage(chatId, menuTitle, { parse_mode: 'HTML', disable_web_page_preview: true });
			}

			stateMap_setMessage_Id(chatId, messageType, msg.message_id)
			// console.log('chatId, messageType, msg.message_id', chatId, messageType, msg.message_id)
			resolve({ messageId: msg.message_id, chatid: msg.chat.id })

		} catch (error) {
			afx.errorLog('openMenu', error)
			resolve(null)
		}
	})
}

async function switchMenu(chatId: string, messageId: number, title: string, json_buttons: any) {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	try {

		await bot.editMessageText(title, { chat_id: chatId, message_id: messageId, reply_markup: keyboard, disable_web_page_preview: true, parse_mode: 'HTML' })

	} catch (error) {
		afx.errorLog('[switchMenuWithTitle]', error)
	}
}


export const replaceMenu = async (chatId: string, messageId: number, messageType: number, menuTitle: string, json_buttons: any = []) => {

	const keyboard = {
		inline_keyboard: json_buttons,
		resize_keyboard: true,
		one_time_keyboard: true,
		force_reply: true
	};

	return new Promise(async (resolve, reject) => {

		try {

			await bot.deleteMessage(chatId, messageId)

		} catch (error) {
			//afx.errorLog('deleteMessage', error)
		}

		await removeMenu(chatId, messageType)

		try {

			let msg: TelegramBot.Message = await bot.sendMessage(chatId, menuTitle, { reply_markup: keyboard, parse_mode: 'HTML', disable_web_page_preview: true });

			stateMap_setMessage_Id(chatId, messageType, msg.message_id)
			// console.log('chatId, messageType, msg.message_id', chatId, messageType, msg.message_id)
			resolve({ messageId: msg.message_id, chatid: msg.chat.id })

		} catch (error) {
			afx.errorLog('openMenu', error)
			resolve(null)
		}
	})
}

export const get_menuTitle = (sessionId: string, subTitle: string) => {

	const session = sessions.get(sessionId)
	if (!session) {
		return 'ERROR ' + sessionId
	}

	let result = session.type === 'private' ? `@${session.username}'s configuration setup` : `@${session.username} group's configuration setup`

	if (subTitle && subTitle !== '') {

		//subTitle = subTitle.replace('%username%', `@${session.username}`)
		result += `\n${subTitle}`
	}

	return result
}

export const removeMessage = async (sessionId: string, messageId: number) => {

	if (sessionId && messageId) {
		try {
			await bot.deleteMessage(sessionId, messageId)
		} catch (error) {
			//console.error(error)
		}
	}
}

export const sendReplyMessage = async (chatid: string, message: string) => {
	try {

		let data: any = { parse_mode: 'HTML', disable_forward: true, disable_web_page_preview: true, reply_markup: { force_reply: true } }

		const msg = await bot.sendMessage(chatid, message, data)
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error) {

		afx.errorLog('sendReplyMessage', error)
		return null
	}
}

export const sendMessage = async (chatid: string, message: string, info: any = {}) => {
	try {

		let data: any = { parse_mode: 'HTML' }

		data.disable_web_page_preview = true
		data.disable_forward = true

		if (info && info.message_thread_id) {
			data.message_thread_id = info.message_thread_id
		}

		const msg = await bot.sendMessage(chatid, message, data)
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error: any) {

		if (error.response && error.response.body && error.response.body.error_code === 403) {
			info.blocked = true;
			if (error?.response?.body?.description == 'Forbidden: bot was blocked by the user') {
				database.removeUser({ chatid });
				sessions.delete(chatid);
			}
		}

		console.log(error?.response?.body)
		afx.errorLog('sendMessage', error)
		return null
	}
}

export const sendInfoMessage = async (chatid: string, message: string) => {

	let json = [
		[
			json_buttonItem(chatid, OptionCode.CLOSE, '✖️ Close')
		],
	]

	return sendOptionMessage(chatid, message, json)
}

export const sendOptionMessage = async (chatid: string, message: string, option: any) => {
	try {

		const keyboard = {
			inline_keyboard: option,
			resize_keyboard: true,
			one_time_keyboard: true,
		};

		const msg = await bot.sendMessage(chatid, message, { reply_markup: keyboard, disable_web_page_preview: true, parse_mode: 'HTML' });
		return { messageId: msg.message_id, chatid: msg.chat ? msg.chat.id : null }

	} catch (error) {
		afx.errorLog('sendOptionMessage', error)

		return null
	}
}

export const pinMessage = (chatid: string, messageId: number) => {
	try {

		bot.pinChatMessage(chatid, messageId)
	} catch (error) {
		console.error(error)
	}
}

export const checkWhitelist = (chatid: string) => {
	return true
}

export const getMainMenuMessage = async (sessionId: string): Promise<string> => {

	const session = sessions.get(sessionId)
	if (!session) {
		return ''
	}

	// You currently have <code>${utils.roundDecimal(session.solCredit, 8)} SOL</code>, <code>${utils.roundDecimal(session.tokenCredit, 8)} ${afx.quoteToken.symbol}</code> balance.To get started with betting, make deposit some SOL or ${afx.quoteToken.symbol} on Credit Menu

	const MESSAGE = `Welcome to ${process.env.BOT_TITLE}, official binary betting bot.

To get started, deposit either SOL and/or ${afx.quoteToken.name}. (Transacting in Taxable_Token will result in a 5% tax)
For more info on your wallet and to make deposit or withdraw funds, tap the wallet button below. We guarantee the safety of user funds on @${process.env.BOT_USERNAME}.

${afx.quoteToken.name} address: ${afx.quoteToken.address}
Your wallet address:<code>${session.wallet}</code> (tap to copy)`

	return MESSAGE;
}

export const json_main = (sessionId: string) => {

	const itemData = `${sessionId}:1`
	const json = [
		[
			json_buttonItem(itemData, OptionCode.TITLE, `🎖️ ${process.env.BOT_TITLE}`),
		],
		[
			json_buttonItem(itemData, OptionCode.WALLET_IMPORT_KEY, 'Input your Wallet'),
		],
		[
			json_buttonItem(itemData, OptionCode.CREATE_TOKEN, 'Create a Token'),
		],
		[
			json_buttonItem(itemData, OptionCode.CREATE_OPENBOOK_MARKET, 'Create a Openbook Market'),
		],
		[
			json_buttonItem(itemData, OptionCode.MAIN_REFERRAL, 'Sell'),
			json_buttonItem(sessionId, OptionCode.MAIN_REFRESH, 'Buy'),
		],
	]

	return { title: '', options: json };
}

export const json_wallet = async (sessionId: string) => {

	const session = sessions.get(sessionId)
	if (!session) {
		return null
	}

	let balance = await utils.roundDecimal(session.solCredit, 8)
	let tokenBalance = await utils.roundDecimal(session.tokenCredit, 8)

	let walletSolBalance = await utils.roundDecimal(await utils.getWalletSOLBalance(session.wallet), 8)
	let walletTokenBalance = await utils.roundDecimal(await utils.getWalletTokenBalance(session.wallet, afx.quoteToken.address, afx.quoteToken.decimals), 8)

	const title = `⬇️ Your credits:

SOL Credit: <code>${balance} SOL</code>
Token Credit: <code>${tokenBalance} ${afx.quoteToken.symbol}</code>

⬇️ Your wallet:

Address: <code>${session.wallet}</code>
SOL Balance: <code>${walletSolBalance} SOL</code>
Token Balance: <code>${walletTokenBalance} ${afx.quoteToken.symbol}</code>

Tap to copy the wallet address and send SOL and/or ${afx.quoteToken.symbol} to make your deposit.`

	const itemData = sessionId
	let json = [
		[
			json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close')
		],
		// [
		// 	json_buttonItem(itemData, OptionCode.WALLET_DEPOSIT_SOL, `Deposit SOL`),
		// 	json_buttonItem(itemData, OptionCode.WALLET_DEPOSIT_TOKEN, `Deposit ${afx.quoteToken.symbol}`),
		// ],
		// [
		// 	json_buttonItem(itemData, OptionCode.WALLET_WITHDRAW_X_SOL, 'Withdraw X SOL'),
		// 	json_buttonItem(itemData, OptionCode.WALLET_WITHDRAW_X_TOKEN, `Withdraw X ${afx.quoteToken.symbol}`),
		// ],
		// [
		// 	json_buttonItem(itemData, OptionCode.WALLET_RESET_WALLET, 'Reset Wallet'),
		// 	json_buttonItem(itemData, OptionCode.WALLET_IMPORT_KEY, 'Import Wallet'),
		// ],
		// [
		// 	json_buttonItem(itemData, OptionCode.WALLET_EXPORT_KEY, 'Export Private Key'),
		// ],
		[
			json_buttonItem(itemData, OptionCode.WALLET_REFRESH, 'Refresh'),
		],

	]
	return { title: title, options: json };
}

export const json_confirm = async (sessionId: string, msg: string, btnCaption: string, btnId: number, itemData: string = '') => {

	const session = sessions.get(sessionId)
	if (!session) {
		return null
	}

	const title = msg

	let json = [
		[
			json_buttonItem(sessionId, OptionCode.CLOSE, '✖️ Close'),
			json_buttonItem(itemData, btnId, btnCaption)
		],

	]
	return { title: title, options: json };
}

export const openConfirmMenu = async (sessionId: string, msg: string, btnCaption: string, btnId: number, itemData: string = '') => {
	const menu: any = await json_confirm(sessionId, msg, btnCaption, btnId, itemData)
	if (menu) {
		await openMenu(sessionId, btnId, menu.title, menu.options)
	}
}

export const createSession = async (chatid: string, username: string, type: string) => {

	let session: any = {}

	session.chatid = chatid
	session.username = username
	session.type = type

	await setDefaultSettings(session)

	sessions.set(session.chatid, session)
	showSessionLog(session)

	return session;
}

export function showSessionLog(session: any) {

	if (session.type === 'private') {
		console.log(`@${session.username} user${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'group') {
		console.log(`@${session.username} group${session.wallet ? ' joined' : '\'s session has been created (' + session.chatid + ')'}`)
	} else if (session.type === 'channel') {
		console.log(`@${session.username} channel${session.wallet ? ' joined' : '\'s session has been created'}`)
	}
}

export const defaultConfig = {
	vip: 0,
}

export const setDefaultSettings = async (session: any) => {

	session.timestamp = new Date().getTime()
	session.solCredit = 0
	session.tokenCredit = 0

	session.referralCode = 'ref_' + utils.encodeChatId(session.chatid)

	const wallet: any = utils.generateNewWallet()
	session.wallet = wallet.publicKey
	session.pkey = utils.encryptPKey(wallet.secretKey)
}

export let _command_proc: any = null
export let _callback_proc: any = null
export async function init(command_proc: any, callback_proc: any) {

	bot = new TelegramBot(process.env.BOT_TOKEN as string,
		{
			polling: true
		})

	bot.getMe().then((info: TelegramBot.User) => {
		myInfo = info
	});

	bot.on('message', async (message: any) => {

		// console.log(`========== message ==========`)
		// console.log(message)
		// console.log(`=============================`)

		const msgType = message?.chat?.type;
		if (msgType === 'private') {
			privateBot.procMessage(message, database);

		} else if (msgType === 'group' || msgType === 'supergroup') {

		} else if (msgType === 'channel') {

		}
	})

	bot.on('callback_query', async (callbackQuery: TelegramBot.CallbackQuery) => {
		// console.log('========== callback query ==========')
		// console.log(callbackQuery)
		// console.log('====================================')

		const message = callbackQuery.message;

		if (!message) {
			return
		}

		const option = JSON.parse(callbackQuery.data as string);
		let chatid = message.chat.id.toString();

		executeCommand(chatid, message.message_id, callbackQuery.id, option)
	})

	_command_proc = command_proc
	_callback_proc = callback_proc

	await database.init()
	const users: any = await database.selectUsers()

	let loggedin = 0
	let admins = 0
	for (const user of users) {

		let session = JSON.parse(JSON.stringify(user))
		session = utils.objectDeepCopy(session, ['_id', '__v'])

		if (session.wallet) {
			loggedin++
		}

		sessions.set(session.chatid, session)
		//showSessionLog(session)

		if (session.admin >= 1) {
			console.log(`@${session.username} user joined as ADMIN ( ${session.chatid} )`)
			admins++
		}
	}

	console.log(`${users.length} users, ${loggedin} logged in, ${admins} admins`)
}


export const reloadCommand = async (chatid: string, messageId: number, callbackQueryId: string, option: any) => {

	await removeMessage(chatid, messageId)
	executeCommand(chatid, messageId, callbackQueryId, option)
}

export const executeCommand = async (chatid: string, _messageId: number | undefined, _callbackQueryId: string | undefined, option: any) => {

	const cmd = option.c;
	const id = option.k;

	const session = sessions.get(chatid)
	if (!session) {
		return
	}
	let messageId = Number(_messageId ?? 0)
	let callbackQueryId = _callbackQueryId ?? ''

	const sessionId: string = chatid
	const stateData: any = { sessionId, messageId, callbackQueryId, cmd }

	try {

		if (cmd === OptionCode.MAIN_MENU) {

			stateMap_setFocus(chatid, StateCode.IDLE, { sessionId })

			const menu: any = await json_main(sessionId);

			let title: string = await getMainMenuMessage(sessionId)

			const popup = parseInt(id)
			if (menu) {
				if (popup)
					await openMenu(chatid, cmd, title, menu.options)
				else
					await switchMenu(chatid, messageId, title, menu.options)
			}

		} else if (cmd === OptionCode.CREATE_TOKEN) {


			const msg = `⚠️ Are you sure you want to create your own taxable token 2022?

WARNING: This action is irreversible!

${process.env.BOT_TITLE} will create new Taxable token and present it's address to you`

			await openConfirmMenu(stateData.sessionId, msg, 'Confirm', OptionCode.WALLET_TOKEN_CREATE_CONFIRM)

		} else if (cmd === OptionCode.CREATE_OPENBOOK_MARKET) {


			const msg = `⚠️ Are you sure you want to create your own openbook market?

WARNING: This action is irreversible!

${process.env.BOT_TITLE} will create new Taxable token and present it's address to you`

			await openConfirmMenu(stateData.sessionId, msg, 'Confirm', OptionCode.OPEBBOOK_CREATE_CONFIRM)

		} else if (cmd === OptionCode.MAIN_WALLET) {

			const popup = parseInt(id)
			const menu: any = await json_wallet(sessionId);

			if (menu) {
				if (popup)
					await openMenu(chatid, cmd, menu.title, menu.options)
				else
					await switchMenu(chatid, messageId, menu.title, menu.options)
			}

		} else if (cmd === OptionCode.WALLET_WITHDRAW_ALL) {

			await sendReplyMessage(stateData.sessionId, `Reply to this message with your destination <b>Wallet Address</b>`);

			stateData.balance = -1
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_WALLET_WITHDRAW_ADDRESS, stateData)

		} else if (cmd === OptionCode.WALLET_WITHDRAW_X_SOL) {

			const msg = `Reply to this message with the amount you want to withdraw (0 - ${utils.roundDecimal(session.solCredit, 8)})`
			await sendReplyMessage(stateData.sessionId, msg);
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_WALLET_WITHDRAW_AMOUNT, stateData)

		} else if (cmd == OptionCode.WALLET_DEPOSIT_SOL) {
			stateData.tokenDeposit = false

			const msg = `Reply to this message with the your solana amount to make deposit`
			await sendReplyMessage(stateData.sessionId, msg);
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_WALLET_DEPOSIT_X_AMOUNT, stateData)

		} else if (cmd == OptionCode.WALLET_DEPOSIT_TOKEN) {

			stateData.tokenDeposit = true

			const msg = `Reply to this message with the your ${afx.quoteToken.symbol} amount to make deposit`
			await sendReplyMessage(stateData.sessionId, msg);
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_WALLET_DEPOSIT_X_AMOUNT, stateData)

		} else if (cmd == OptionCode.WALLET_WITHDRAW_CONFIRM) {

			await removeMessage(sessionId, messageId)

			const stateItem = stateMap_getFocus(sessionId)
			if (stateItem && stateItem.state === StateCode.WAIT_SET_WALLET_WITHDRAW_ADDRESS) {

				let amount = stateItem.data.balance

				let balance = session.solCredit
				let balanceV = balance
				balanceV -= afx.Default_Swap_Heap
				balanceV *= (100 - afx.Swap_Fee_Percent) / 100

				if (amount < 0) {
					amount = balanceV
				} else if (amount > balanceV) {
					amount = balanceV
				}
			}
		} else if (cmd === OptionCode.CLOSE) {

			await removeMessage(sessionId, messageId)

		} else if (cmd === OptionCode.MAIN_REFRESH) {

			executeCommand(chatid, messageId, callbackQueryId, { c: OptionCode.MAIN_MENU, k: 0 })

		} else if (cmd == OptionCode.WALLET_IMPORT_KEY) {
			const msg = `⚠️ Are you sure you want to import your ${process.env.BOT_TITLE} Wallet?

WARNING: This action is irreversible!

${process.env.BOT_TITLE} will import a new wallet for you and discard your old one`

			await openConfirmMenu(stateData.sessionId, msg, 'Confirm', OptionCode.WALLET_IMPORT_KEY_CONFIRM)

		} else if (cmd == OptionCode.WALLET_RESET_WALLET_CONFIRM) {

			const wallet: any = utils.generateNewWallet()
			session.wallet = wallet.publicKey
			session.pkey = utils.encryptPKey(wallet.secretKey)

			await removeMessage(stateData.sessionId, messageId)

			await sendInfoMessage(stateData.sessionId, `✅ New ${process.env.BOT_TITLE} wallet has been generated`)
			executeCommand(stateData.sessionId, undefined, undefined, { c: OptionCode.MAIN_WALLET, k: `1` })

		} else if (cmd == OptionCode.WALLET_IMPORT_KEY_CONFIRM) {
			await removeMessage(stateData.sessionId, messageId)
			await sendReplyMessage(stateData.sessionId, `Please Input your <b>Wallet Private Key</b>`);
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_WALLET_IMPORT_PKEY, stateData)
			// executeCommand(stateData.sessionId, undefined, undefined, { c: OptionCode.MAIN_WALLET, k: `1` })
		} else if (cmd == OptionCode.WALLET_TOKEN_CREATE_CONFIRM) {

			await removeMessage(stateData.sessionId, messageId)
			await sendReplyMessage(stateData.sessionId, `Please Input your <b>Token Name</b>`);
			stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_TOKEN_NAME, stateData)
		} else if (cmd == OptionCode.OPEBBOOK_CREATE_CONFIRM) {

			await removeMessage(stateData.sessionId, messageId)
			await sendReplyMessage(stateData.sessionId, `Please Input your <b>Token Address</b>`);
			stateMap_setFocus(stateData.sessionId, StateCode.OPENBOOK_SET_TOKEN_ADDRESS, stateData)
		} 

	} catch (error) {
		console.log(error)
		sendMessage(chatid, `😢 Sorry, there was some errors on the command. Please try again later 😉`)
		if (callbackQueryId)
			await bot.answerCallbackQuery(callbackQueryId, { text: `😢 Sorry, there was some errors on the command. Please try again later 😉` })
	}
}
