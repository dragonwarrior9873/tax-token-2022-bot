import * as instance from './bot'
import {StateCode, OptionCode} from './bot'
import * as utils from './utils'
import * as afx from './global'
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

	} else if (message) {

		processSettings(message, database);
		await instance.removeMessage(chatid, message.message_id) //TGR
		await instance.removeMessage(chatid, message.message_id)

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

	} 
	
	//Buy & Sell operation
	else if (stateNode.state === StateCode.WAIT_SET_WALLET_WITHDRAW_AMOUNT) {

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

	} 


	//Token 2022 Creation 
	else if (stateNode.state === StateCode.WAIT_SET_TOKEN_NAME) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 || value.length > 100) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.tokenName = value

		const msg1 = `Token name successfully set. Next please enter token decimals.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_TOKEN_DECIMAL, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_TOKEN_DECIMAL) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.decimals = value

		const msg1 = `Token decimals successfully set. Next please enter token Metadata Url.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_TOKEN_METADATA_URL, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_TOKEN_METADATA_URL) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.metadata = value

		const msg1 = `Token Metadata successfully set. Next please enter token Total Supply.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_TOTAL_SUPPLY, stateData)
	} else if (stateNode.state === StateCode.WAIT_SET_NEW_TOTAL_SUPPLY) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.totalSupply = value
		const msg1 = `Kindly check below information and click confirm button to create a Token with infos.

		🔸 Token Name is: <code>${stateData.tokenName}</code>.
		🔹 Token Decimal is: <code>${stateData.decimals}</code>
		🔹 Token Metadata Url is: <code>${stateData.metadata}</code>
		🔸 Token Total Supply is: <code>${stateData.totalSupply}</code>`
		await instance.openConfirmMenu(stateData.sessionId, msg1, 'Confirm', OptionCode.GAME_NEW_CONFIRM)
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_TOKEN_CONFIRM, stateData)
	} 


	///Openbook Market Creation
	else if (stateNode.state === StateCode.OPENBOOK_SET_TOKEN_ADDRESS) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 || value.length > 100) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.tokenAddress = value

		const msg1 = `Token tokenAddress successfully set. Next please enter Quote Token Address.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.OPENBOOK_SET_QUOTE_ADDRESS, stateData)
	} else if (stateNode.state === StateCode.OPENBOOK_SET_QUOTE_ADDRESS) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.quoteAddress = value

		const msg1 = `Quote Token Address successfully set. Next please enter Minimum Order Size.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.OPENBOOK_SET_MINIMUM_ORDER_SIZE, stateData)
	} else if (stateNode.state === StateCode.OPENBOOK_SET_MINIMUM_ORDER_SIZE) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.miniumOrder = value

		const msg1 = `Openbook Market minimum order size successfully set. Next please enter minimum price ticket size.`
		await instance.sendReplyMessage(stateData.sessionId, msg1);
		instance.stateMap_setFocus(stateData.sessionId, StateCode.OPENBOOK_SET_MINIMUM_PRICE_TICKET_SIZE, stateData)
	} else if (stateNode.state === StateCode.OPENBOOK_SET_MINIMUM_PRICE_TICKET_SIZE) {

		const value = msg.text.trim()
		if (!value || value.length <= 0 ) {
			await instance.sendInfoMessage(sessionId, `🚫 Sorry, the value you entered is invalid. Please try again`)
			return
		}

		stateData.miniumPrice = value
		const msg1 = `Kindly check below information and click confirm button to create a Openbook Market with infos.

		🔸 Token Address is: <code>${stateData.tokenAddress}</code>.
		🔹 Quote Token Address is: <code>${stateData.quoteAddress}</code>
		🔹 Minimum Order Size is: <code>${stateData.miniumOrder}</code>
		🔸 Minimum Price Size is: <code>${stateData.miniumPrice}</code>`
		await instance.openConfirmMenu(stateData.sessionId, msg1, 'Confirm', OptionCode.GAME_NEW_CONFIRM)
		instance.stateMap_setFocus(stateData.sessionId, StateCode.WAIT_SET_NEW_TOKEN_CONFIRM, stateData)
	}
}
