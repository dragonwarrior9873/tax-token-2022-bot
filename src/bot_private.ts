import * as instance from './bot'
import {StateCode, OptionCode} from './bot'
import * as utils from './utils'
import * as afx from './global'
import * as uniconst from './uniconst'
import * as depoDetector from './deposit_detector'
import * as swapManager from './swap_manager'

import assert from 'assert'
import dotenv from 'dotenv'

dotenv.config()

/*

start - welcome
snipe - snipe setting
wallet - manage your bot wallet
*/

const parseCode = async (database: any, session: any, wholeCode: string) => {

	let codes: string[] = wholeCode.split('_')
	console.log(codes)

	if (codes.length % 2 === 0) {
		for (let i = 0; i < codes.length; i += 2) {

			const type = codes[i]
			const code = codes[i + 1]

			if (type === 'ref') {

				if (!session.referredBy) {
					let referredBy: string = ''
			
					referredBy = utils.decodeChatId(code)
					if (referredBy === '' || referredBy === session.chatid) {
						continue
					}
			
					if (referredBy.length > 0) {
			
						const refSession = instance.sessions.get(referredBy)
						if (refSession) {
							console.log(`${session.username} has been invited by @${refSession.username} (${refSession.chatid})`)
						}
			
						instance.sendInfoMessage(referredBy, `Great news! You have invited @${session.username}
You can earn 30% of their fees in the first month. 20% in the second and 10% forever!`)
			
						session.referredBy = referredBy
						session.referredTimestamp = new Date().getTime()

						await database.updateUser(session)
					}
				}

			} else if (type === 'ga') {
				
				if (session && instance._callback_proc) {
					// instance._callback_proc(OptionCode.GAME_DETAIL, { session, gameId: code })
					await instance.executeCommand(session.chatid, undefined, undefined, {c: OptionCode.GAME_DETAIL, k:1 })
				}

				return true

			} 
		}
	}

	return false
}

export const procMessage = async (message: any, database: any) => {

	let chatid = message.chat.id.toString();
	let session = instance.sessions.get(chatid)
	let userName = message?.chat?.username;
	let messageId = message?.messageId

	if (message.photo) {
		console.log(message.photo)
		processSettings(message, database);
	}

	if (message.animation) {
		console.log(message.animation)
		processSettings(message, database);
	}

	if (!message.text)
		return;

	let command = message.text;
	if (message.entities) {
		for (const entity of message.entities) {
			if (entity.type === 'bot_command') {
				command = command.substring(entity.offset, entity.offset + entity.length);
				break;
			}
		}
	}

	if (command.startsWith('/')) {

		if (!session) {

			if (!userName) {
				console.log(`Rejected anonymous incoming connection. chatid = ${chatid}`);
				instance.sendMessage(chatid, `Welcome to ${process.env.BOT_TITLE} bot. We noticed that your telegram does not have a username. Please create username [Setting]->[Username] and try again.`)
				return;
			}

			if (false && !await instance.checkWhitelist(chatid)) {

				//instance.sendMessage(chatid, `😇Sorry, but you do not have permission to use alphBot. If you would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thanks!`);
				console.log(`Rejected anonymous incoming connection. @${userName}, ${chatid}`);
				return;
			}

			console.log(`@${userName} session has been permitted through whitelist`);

			session = await instance.createSession(chatid, userName, 'private');
			session.permit = 1;

			await database.updateUser(session)
		}

		if (userName && session.username !== userName) {
			session.username = userName
			await database.updateUser(session)
		}

		// if (session.permit !== 1) {
		// 	session.permit = await instance.isAuthorized(session) ? 1 : 0;
		// }

		// if (false && session.permit !== 1) {
		// 	//instance.sendMessage(chatid, `😇Sorry, but you do not have permission to use alphBot. If you would like to use this bot, please contact the developer team at ${process.env.TEAM_TELEGRAM}. Thank you for your understanding. [2]`);
		// 	return;
		// }

		let params = message.text.split(' ');
		if (params.length > 0 && params[0] === command) {
			params.shift()
		}
		
		command = command.slice(1);

		if (command === instance.COMMAND_START) { 

			let hideWelcome: boolean = false
			if (params.length == 1 && params[0].trim() !== '') {

				let wholeCode = params[0].trim()
				hideWelcome = await parseCode(database, session, wholeCode)
			}

			if (!hideWelcome) {
				await instance.executeCommand(chatid, undefined, undefined, {c: OptionCode.MAIN_MENU, k:1 })
			}

		} else {
			
			console.log(`Command Execute: /${command} ${params}`)
			if (instance._command_proc) {
				instance._command_proc(session, command, params, messageId)
			}
		}

		// instance.stateMap_remove(chatid)

	} else if (message.reply_to_message) {

		processSettings(message, database);
		await instance.removeMessage(chatid, message.message_id) //TGR
		await instance.removeMessage(chatid, message.reply_to_message.message_id)

	} 
}

const processSettings = async (msg: any, database: any) => {

	const sessionId = msg.chat?.id.toString()

	const session = instance.sessions.get(sessionId)
	if (!session) {
		return
	}

	let stateNode = instance.stateMap_getFocus(sessionId)
	if (!stateNode) {
		instance.stateMap_setFocus(sessionId, StateCode.IDLE, { sessionId: sessionId })
		stateNode = instance.stateMap_get(sessionId)

		assert(stateNode)
	}

	const stateData = stateNode.data
		
	if (stateNode.state === StateCode.WAIT_SET_WALLET_IMPORT_PKEY) {

		const value = msg.text.trim()
		if (!value || value === '') {
			instance.sendInfoMessage(sessionId, `🚫 Sorry, the contract address you entered is invalid. Please try again`)
			return
		}

		const isSeed = utils.isValidSeedPhrase(value)

		let pkey: string | null = null, seed: string | null = null

		if (!isSeed) {

			if (!utils.isValidPrivateKey(value)) {
				await instance.sendInfoMessage(sessionId, `🚫 Sorry, the key you entered is invalid. Please try again`)
				return
			}

			pkey = value

		} else {

			seed = value
			pkey = await utils.seedPhraseToPrivateKey(value)
			if (!pkey) {
				await instance.sendInfoMessage(sessionId, `🚫 Sorry, the mnemonic key you entered is invalid. Please try again`)
				return
			}
		}

		let wallet = utils.getWalletFromPrivateKey(pkey ?? '')
		if (!wallet) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the private key you entered is invalid. Please try again`)
			return
		}

		session.wallet = wallet.publicKey
		session.pkey = utils.encryptPKey(pkey as string)

		await database.updateUser(session)
		await instance.sendInfoMessage(sessionId, `✅ New wallet has been imported successfully.`)

		instance.executeCommand(sessionId, undefined, undefined, {c: OptionCode.MAIN_WALLET, k:`${sessionId}:1` })

	} else if (stateNode.state === StateCode.WAIT_SET_WALLET_WITHDRAW_AMOUNT) {

		const value = Number(msg.text.trim())
		if (isNaN(value) || value <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the SOL amount you entered is invalid. Please try again`)
			return
		}

		session.trxPriority = 0
		session.trxPriorityAmount = value

		await database.updateUser(session)

		await instance.sendInfoMessage(sessionId, `✅ Trx Priority SOL amount has been updated to ${value} SOL`)
		instance.executeCommand(stateData.sessionId, stateData.messageId, stateData.callbackQueryId, {c: OptionCode.CREATE_TOKEN, k:0 })

	} else if (stateNode.state === StateCode.WAIT_SET_WALLET_WITHDRAW_ADDRESS) {

		const value = Number(msg.text.trim())
		if (isNaN(value) || value <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		if (value > 50) {
			const msg1 = `⚠️ WARNING: Slippage over 50% is dangerous! You are risking getting a significantly worse price and higher fees than what you expect. Please make sure you know what you are doing before making slippage this high.`
			await instance.sendInfoMessage(sessionId, msg1)
		}

		session.buySlippage = value

		await database.updateUser(session)

		await instance.sendInfoMessage(sessionId, `✅ Buy slippage value has been updated to ${value}%`)
		instance.executeCommand(stateData.sessionId, stateData.messageId, stateData.callbackQueryId, {c: OptionCode.MAIN_MYGAMES, k:0 })

	} else if (stateNode.state === StateCode.WAIT_SET_WALLET_DEPOSIT_PAYER_ADDRESS) {

		const value = msg.text.trim()
		if (!value || value.length <= 0) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		if (!utils.isValidAddress(value)) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the wallet address you entered is invalid. Please try again`)
			return
		}

		stateData.payer = value


		await instance.openMenu(sessionId, OptionCode.MONITOR_DEPOSIT, `🔎 Monitoring your SOL, ${afx.quoteToken.symbol} deposit for 

Send the <b>any amount of SOL or ${afx.quoteToken.symbol}</b> from your wallet to the address shown as below
Your wallet: <code>${value}</code> <i>(Payment From)</i>
Deposit wallet: <code>${afx.get_treasury_wallet_address()}</code> <i>(Payment To)</i>

⏱️ Time left to deposit - ${depoDetector.AUTO_DISPOSE_MINS} mins

⚠️ Attention! 
<i>Please ensure that you send the SOL or ${afx.quoteToken.symbol} token in a single transaction to avoid potential issues with your deposit. Sending payments in multiple transactions is not supported. Also, make sure to use the wallet address provided above for this payment, as the monitoring system won't be able to detect your transaction otherwise</i>`);

	} else if (stateNode.state === StateCode.WAIT_SET_WALLET_DEPOSIT_X_AMOUNT) {

		const value = Number(msg.text.trim())
		if (isNaN(value) || value <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the SOL amount you entered is invalid. Please try again`)
			return
		}

		if (stateData.tokenDeposit) {

			swapManager.transferSOL(database, session, session.wallet, value)
		} else {

			swapManager.transferToken(database, session, session.wallet, afx.quoteToken.address, value)
		}

	} else if (stateNode.state === StateCode.WAIT_SET_NEW_GAME_TITLE) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 || value.length > 100) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.gameTitle = value

		const msg1 = `Reply to this message with the Game Description. The length must NOT be greater than 200`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_GAME_OPENTIME, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_GAME_DESC) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 || value.length > 200) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.gameDesc = value

		const msg1 = `Reply to this message with the Open Time. Time format must be 0000-00-00 00:00:00`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_GAME_OPENTIME, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_GAME_OPENTIME) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		let timestamp = Date.parse(value);
		if (isNaN(timestamp)) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time format you entered is invalid. Please try again`)
			return
		}

		if (timestamp <= new Date().getTime()) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time you entered must be later than the current time`)
			return
		}

		stateData.gameOpenTime = timestamp

		const msg1 = `Reply to this message with the Close Time. Time format must be like 0000-00-00 00:00:00 and later then Open Time (${utils.getTimeStringFormat(stateData.gameOpenTime)})`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_GAME_CLOSETIME, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_GAME_CLOSETIME) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		let timestamp = Date.parse(value);
		if (isNaN(timestamp)) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time format you entered is invalid. Please try again`)
			return
		}

		if (timestamp <= new Date().getTime()) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time you entered must be later than the current time`)
			return
		}

		stateData.gameCloseTime = value

		const msg1 = `Reply to this message with the Settle Time. Time format must be like 0000-00-00 00:00:00 and later then Close Time (${utils.getTimeStringFormat(stateData.gameCloseTime)})`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_GAME_SETTLETIME, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_GAME_SETTLETIME) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}
		
		let timestamp = Date.parse(value);
		if (isNaN(timestamp)) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time format you entered is invalid. Please try again`)
			return
		}

		if (timestamp <= new Date().getTime()) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the time you entered must be later than the current time`)
			return
		}

		stateData.gameSettleTime = value

		const msg1 = `Kindly check below information and click confirm button.

Title: <code>${stateData.gameTitle}</code>.
Description: <code>${stateData.gameDesc}</code>

Time:
🔸 Open: <code>${utils.getTimeStringFormat(stateData.gameOpenTime)}</code>
🔹 Close: <code>${utils.getTimeStringFormat(stateData.gameCloseTime)}</code>
🔹 Settle: <code>${utils.getTimeStringFormat(stateData.gameSettleTime)}</code>`
		
		await instance.openConfirmMenu(stateData.sessionId, msg1, 'Confirm', OptionCode.GAME_NEW_CONFIRM)
	}
}
