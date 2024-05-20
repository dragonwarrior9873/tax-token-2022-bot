import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import WebSocket from 'ws'
import * as afx from './global'
import dotenv from 'dotenv'
dotenv.config()


// function checkTransaction(txData, currentSlot) {
//     connection.getTransaction(txData.txHash).then(async (receipt) => {
//       if (receipt && currentSlot == receipt.slot) {
//         console.log(
//           `Wallet ${txData.address}, Transaction ${txData.txHash} was successful!`
//         );
//         const tx = await connection.getParsedTransaction(txData.txHash);
//         const instructions = tx.transaction.message.instructions;
//         for (let instruction of instructions) {
//           if (instruction.program && instruction.program == 'system'
//             && instruction.parsed && instruction.parsed.type == 'transfer') {
  
//             const info = instruction.parsed.info;
//             const etherValue = info.lamports / LAMPORTS_PER_SOL;
//             const toAddress = info.destination;
//             console.log(
//               `Transferred ${etherValue} SOL to ${toAddress}`
//             );
//             if (toAddress.toLowerCase() === treasuryWallet.publicKey.toBase58().toLowerCase() && etherValue > 0) {
//               const player = await PlayerInfo.findOne({ address: txData.address });
//               const deposit = new DepositHistory({ address: txData.address, txHash: txData.txHash })
//               deposit.save()
//               if (!player) {
//                 try {
//                   const newPlayer = new PlayerInfo({
//                     address: txData.address,
//                     avatar: Config.defaultAvatarUrl,
//                     country: Country.US,
//                     balance: etherValue * Config.gameCoinDecimal,
//                   });
//                   await newPlayer.save();
//                   addGlobalPlayer(newPlayer);
//                 } catch (error) {
//                   console.log('create player error', error);
//                 }
//               } else {
//                 const newBalance =
//                   etherValue * Config.gameCoinDecimal + player.balance;
//                 try {
//                   await PlayerInfo.updateOne(
//                     { address: txData.address },
//                     { balance: newBalance }
//                   );
//                   updateGlobalPlayer({
//                     address: txData.address,
//                     balance: newBalance,
//                   });
//                 } catch (error) {
//                   console.log('Player Info Update Error', error);
//                 }
  
//               }
//             }
//           }
//         }
//         removeGlobalSwappingAddress(txData.address);
//       } else {
//         if (!receipt) {
//           // Receipt is null when the transaction is not yet mined.
//           console.log(
//             `Wallet ${txData.address}, Transaction ${txData.txHash} is pending.`
//           );
//         } else {
//           console.log(
//             `Wallet ${txData.address}, Transaction ${txData.txHash} failed!`
//           );
//           removeGlobalSwappingAddress(txData.address);
//         }
//       }
//     });
//   }
  

export const start = async (
  // callback: Function
  ) => {

    const bytes = bs58.decode(afx.get_treasury_wallet_key())
    const treasuryWallet = Keypair.fromSecretKey(bytes);
 
    const websocket = new WebSocket(process.env.MAINNET_RPC_WSS as string);

    websocket.onopen = function (event) {
      // Send the subscription request
      const message = JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "blockSubscribe",
        "params": [
          // {
          //   "mentionsAccountOrProgram": treasuryWallet.publicKey.toBase58()
          // },
          {
            "commitment": "finalized",
            "encoding": "base64",
            "showRewards": true,
            "transactionDetails": "full"
          }
        ]
      });
      websocket.send(message)
    };
    
    websocket.onmessage = function (event: any) {
      const response = JSON.parse(event.data);
      // Check if the message is a notification
      if (response.method === 'blockNotification') {

      console.log("123!!!!!!!!!!!!!!", response)

        let blockData = response.params.result;
        let currentSlot = blockData.value.slot;
        if (blockData.value.block) {
          let transactions = blockData.value.block.transactions;
          if (transactions.length > 0) {

            for (const tx of transactions) {
              console.log(tx)
            }
            //parseBlock(blockData.value.block, callback)
            // for (let txData of getGlobalSwappingAddresses()) {
            //   if (txData.txHash && txData.address) {
            //     checkTransaction(txData, currentSlot);
            //   }
            // }
          }
        }
      }
    };

    startAutoDisposeThread(1000 * 60)

    console.log('Deposit detector daemon has been started...')
}

export const push = async (chatid: string, userWallet: string, depositWallet: string, callback: Function) => {

    const depoInfo = monitorMap.get(chatid)
    if (depoInfo) {
        return false
    }
    monitorMap.set(chatid, {
        userWallet: userWallet.toLowerCase(), 
        depositWallet: depositWallet.toLowerCase(),
        timestamp: new Date().getTime(),
        callback,
    })

    return true
}

export const monitorMap = new Map()

const parseBlock = async (block: any, callback: Function) => {
   
    if (block && block.transactions) {

        for (const [chatid, depoInfo] of monitorMap) {

            if (depoInfo.txHash) {
                monitorMap.delete(chatid)
                continue
            }

            console.log(depoInfo)

            // const relevantTxs = block.transactions.filter(tx =>
            //     tx.to && tx.to.toLowerCase() === depoInfo.depositWallet &&
            //     tx.from && tx.from.toLowerCase() === depoInfo.userWallet);

            // for (const tx of relevantTxs) {
            //     const amount = utils.formatEther(tx.value)
            //     if (Number(amount) >= Number(depoInfo.depositAmount)) {

            //         if (depoInfo.callback) {
            //             depoInfo.callback({
            //                 status: 'success',
            //                 amount,
            //                 tx: tx.hash,
            //                 userWallet: depoInfo.userWallet,
            //                 depositWallet: depoInfo.depositWallet
            //             })
            //         }

            //         monitorMap.delete(chatid)
            //         break
            //     }

            //     console.log(amount, depoInfo.depositAmount)
            // }
        }
    }
  };

const startAutoDisposeThread = (interval: number) => {

    setTimeout(() => {

        autoDisposeThread(interval)

    }, interval)
}

export const AUTO_DISPOSE_MINS = 10
export const autoDisposeThread = async (interval: number) => {

    for (const [chatid, depoInfo] of monitorMap) {

        let currentTime = new Date().getTime()
        if (depoInfo.timestamp + (AUTO_DISPOSE_MINS * 60 * 1000) < currentTime) {
            if (depoInfo.callback) {
                depoInfo.callback({
                    status: 'failed',
                    userWallet: depoInfo.userWallet,
                    depositWallet: depoInfo.depositWallet
                })
            }

            monitorMap.delete(chatid)
        }
    }

    startAutoDisposeThread(interval)
}