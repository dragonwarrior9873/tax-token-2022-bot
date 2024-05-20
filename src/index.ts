
import * as bot from "./bot"
import { OptionCode } from "./bot"
import * as utils from './utils'
import * as database from './db'
import * as afx from './global'
import { DelayDetector } from "./delay_detector"
import { Connection, clusterApiUrl } from "@solana/web3.js";
import * as server from '../server'
import * as depoDetector from './deposit_detector'

import dotenv from 'dotenv'
dotenv.config()

const conn: Connection = new Connection(clusterApiUrl(afx.getCluserApiType() as any), "confirmed");
//const conn: Connection = new Connection(process.env.MAINNET_RPC as string, "confirmed");

afx.setWeb3(conn)

bot.init(async (session: any, command: string, params: any, messageId: number) => {

    try {

        if (command === parseInt(command).toString()) {

            // const trackNum = parseInt(command)
            // const item: any = await database.selectPanelByRowNumber(session.chatid, trackNum)

            // console.log(item)
            // if (item) {
            //     bot.trackPanel(session.chatid, item.id, 0)
            // }

        }

    } catch (error) {

    }


}, async (option: number, param: any) => {

    // if (option === OptionCode.MSG_GETTOKENINFO) {
    //     const session = param.session
    //     const address = param.address
    // }
})

afx.init()
server.start(bot);
// depoDetector.start()
