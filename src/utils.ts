import EventEmitter from 'events'
import axios from 'axios'
import * as fs from 'fs'
import assert from 'assert';
import * as afx from './global'
import bs58 from "bs58";
import * as bip39 from "bip39";
import * as crypto from './aes'

import dotenv from 'dotenv'
dotenv.config()

import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js"
import { Metaplex } from "@metaplex-foundation/js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

import {
    SPL_ACCOUNT_LAYOUT,
  } from "@raydium-io/raydium-sdk";

export const isValidAddress = (address: string) => {
    try {
        const publicKey = new PublicKey(address);
        return true;
    } catch (error) {
        return false;
    }
}

export function isValidPrivateKey(privateKey: string) {

    try {
        const key = bs58.decode(privateKey)
        const keypair = Keypair.fromSecretKey(key);
        return true;
    } catch (error) {
        return false;
    }
}

export function getWalletFromPrivateKey(privateKey: string) : any | null {

    try {
        const key: Uint8Array = bs58.decode(privateKey)
        const keypair: Keypair = Keypair.fromSecretKey(key);

        const publicKey = keypair.publicKey.toBase58()
        const secretKey = bs58.encode(keypair.secretKey)

        return { publicKey, secretKey, wallet: keypair }
    } catch (error) {
        return null;
    }
}

export const generateNewWallet = () => {

    try {

        const keypair: Keypair = Keypair.generate()

        const publicKey = keypair.publicKey.toBase58()
        const secretKey = bs58.encode(keypair.secretKey)

        return { publicKey, secretKey }

    } catch (error) {

        console.log(error)
        return null
    }
}

export function isValidSeedPhrase(seedPhrase: string) {
    // Check if the seed phrase is valid
    const isValid = bip39.validateMnemonic(seedPhrase);

    return isValid;
}

export async function seedPhraseToPrivateKey(seedPhrase: string): Promise<string | null> {
    try {
        const seed: Buffer = bip39.mnemonicToSeedSync(seedPhrase).slice(0, 32); // Take the first 32 bytes for the seed
        const keypair: Keypair = Keypair.fromSecretKey(Uint8Array.from(seed));
        return bs58.encode(keypair.secretKey);
    } catch (error) {
        return null;
    }
}


export const roundDecimal = (number: number, digits: number = 5) => {
    return number.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export const roundDecimalWithUnit = (number: number, digits: number = 5, unit: string = '') => {
    if (!number) {
      return afx.NOT_ASSIGNED
    }
    return number.toLocaleString('en-US', {maximumFractionDigits: digits}) + unit;
}

export const sRoundDecimal = (number: number, digits: number) => {

    let result = roundDecimal(number, digits)
    return number > 0 ? `+${result}` : result
}

export const sRoundDecimalWithUnitAndNull = (number: number | null, digits: number, unit: string) => {

    if (!number) {
        return 'None'
    }

    if (number === 0) {
        return `0${unit}`
    }

    let result = roundDecimal(number, digits)
    return number > 0 ? `+${result}${unit}` : `${result}${unit}`
}

export const roundSolUnit = (number: number, digits: number = 5) => {

    if (Math.abs(number) >= 0.00001 || number === 0) {
        return `${roundDecimal(number, digits)} SOL`
    }

    number *= 1000000000

    return `${roundDecimal(number, digits)} lamports`
}

export const roundBigUnit = (number: number, digits: number = 5) => {

    let unitNum = 0
    const unitName = ['', 'K', 'M', 'B']
    while (number >= 1000) {

        unitNum++
        number /= 1000

        if (unitNum > 2) {
            break
        }
    }

    return `${roundDecimal(number, digits)} ${unitName[unitNum]}`
}

export const shortenAddress = (address: string, length: number = 6) => {
    if (address.length < 2 + 2 * length) {
        return address; // Not long enough to shorten
    }

    const start = address.substring(0, length + 2);
    const end = address.substring(address.length - length);

    return start + "..." + end;
}

export const shortenString = (str: string, length: number = 8) => {

    if (length < 3) {
        length = 3
    }

    if (!str) {
        return "undefined"
    }

    if (str.length < length) {
        return str; // Not long enough to shorten
    }

    const temp = str.substring(0, length - 3) + '...';

    return temp;
}

export const limitString = (str: string, length: number = 8) => {

    if (length < 3) {
        length = 3
    }

    if (!str) {
        return "undefined"
    }

    if (str.length < length) {
        return str; // Not long enough to shorten
    }

    const temp = str.substring(0, length);

    return temp;
}


export const getTimeStringUTC = (timestamp: Date) => {

    const options: any = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        timeZone: 'UTC'
    };

    const formattedDate = timestamp.toLocaleString('en-US', options);

    return formattedDate
}

export const getTimeStringFormat = (timestamp: number) => {

    let date = new Date(timestamp)
    let year = date.getFullYear();
    let month = String(date.getMonth() + 1).padStart(2, '0');
    let day = String(date.getDate()).padStart(2, '0');
    let hours = String(date.getHours()).padStart(2, '0');
    let minutes = String(date.getMinutes()).padStart(2, '0');
    let seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const getTimeStringUTCFromNumber = (timestamp: number) => {

    try {
        return getTimeStringUTC(new Date(timestamp))
    } catch (error) {

    }

    return 'None'
}

export const fetchAPI = async (url: string, method: 'GET' | 'POST', data: Record<string, any> = {}): Promise<any | null> => {
    return new Promise(resolve => {
        if (method === "POST") {
            axios.post(url, data).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                // console.error('[fetchAPI]', error)
                resolve(null);
            });
        } else {
            axios.get(url).then(response => {
                let json = response.data;
                resolve(json);
            }).catch(error => {
                // console.error('fetchAPI', error);
                resolve(null);
            });
        }
    });
};

export const addressToHex = (address: string) => {
    const hexString = '0x' + address.slice(2).toLowerCase().padStart(64, '0');
    return hexString.toLowerCase();
}

export const createDirectoryIfNotExists = (directoryPath: string) => {
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath);
        console.log(`The directory '${directoryPath}' has been created.`);
    } else {
    }
};

export const getShortenedAddress = (address: string) => {

    if (!address) {
        return ''
    }

    let str = address.slice(0, 24) + '...'

    return str
}

export function waitForEvent(eventEmitter: EventEmitter, eventName: string): Promise<void> {
    return new Promise<void>(resolve => {
        eventEmitter.on(eventName, resolve);
    });
}

export async function waitSeconds(seconds: number) {
    const eventEmitter = new EventEmitter()

    setTimeout(() => {
        eventEmitter.emit('TimeEvent')
    }, seconds * 1000)

    await waitForEvent(eventEmitter, 'TimeEvent')
}

export async function waitMilliseconds(ms: number) {
    const eventEmitter = new EventEmitter()

    setTimeout(() => {
        eventEmitter.emit('TimeEvent')
    }, ms)

    await waitForEvent(eventEmitter, 'TimeEvent')
}

export const getFullTimeElapsedFromSeconds = (totalSecs: number) => {

    if (totalSecs < 0) {
        totalSecs = 0
    }

    let sec = 0, min = 0, hour = 0, day = 0

    sec = totalSecs
    if (sec > 60) {
        min = Math.floor(sec / 60)
        sec = sec % 60
    }

    if (min > 60) {
        hour = Math.floor(min / 60)
        min = min % 60
    }

    if (hour > 24) {
        day = Math.floor(hour / 24)
        hour = hour % 60
    }

    let timeElapsed = ''

    if (day > 0) {
        timeElapsed += `${day}d`
    }

    if (hour > 0) {
        if (timeElapsed !== '') {
            timeElapsed += ' '
        }

        timeElapsed += `${hour}h`
    }

    if (min > 0) {
        if (timeElapsed !== '') {
            timeElapsed += ' '
        }

        timeElapsed += `${min}m`
    }

    if (sec > 0) {
        if (timeElapsed !== '') {
            timeElapsed += ' '
        }

        timeElapsed += `${sec}s`
    }

    return timeElapsed
}

export const getFullMinSecElapsedFromSeconds = (totalSecs: number) => {

    let sec = 0, min = 0, hour = 0, day = 0

    sec = totalSecs
    if (sec > 60) {
        min = Math.floor(sec / 60)
        sec = sec % 60
    }

    let timeElapsed = `${min}:${sec}`

    return timeElapsed
}

export const sleep = (ms: number) => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const getDateTimeFromTimestamp = (timestmp: number) => {

    const value = new Date(timestmp)
    let month = (value.getMonth() + 1).toString()
    let day = value.getDate().toString()
    let year = value.getFullYear().toString()

    return `${month}/${day}/${year}`
}

export const getConfigString_Default = (value: string, defaultValue: string, unit: string = '', prefix: string = '', digit: number = 9) => {

    let output

    const value2 = (typeof value === 'number' ? roundDecimal(value, digit) : value)

    let temp
    if (unit === 'USD') {
        temp = `$${value2}`
    } else if (unit === '%') {
        temp = `${value2}%`
    } else {
        temp = `${value2}${unit.length > 0 ? ' ' + unit : ''}`
    }

    if (value === defaultValue) {
        output = `Default (${prefix}${temp})`
    } else {
        output = `${prefix}${temp}`
    }

    return output
}

export const getConfigString_Text = (text: string, value: number, autoValue: number, unit: string = '', digit: number = 9) => {

    let output

    if (value === autoValue) {
        output = text
    } else {

        const value2 = (typeof value === 'number' ? roundDecimal(value, digit) : value)
        if (unit === 'USD') {
            output = `$${value2}`
        } else if (unit === '%') {
            output = `${value2}%`
        } else {
            output = `${value2}${unit.length > 0 ? ' ' + unit : ''}`
        }
    }

    return output
}

export const getConfigString_Checked = (value: number) => {

    let output

    if (value === 2) {
        output = '🌐'
    } else if (value === 1) {
        output = '✅'
    } else {
        output = '❌'
    }

    return output
}

export const getConfigWallet_Checked = (value: number) => {

    let output

    if (value === 1) {
        output = '✅'
    } else {
        output = ''
    }

    return output
}

export function objectDeepCopy(obj: any, keysToExclude: string[] = []): any {
    if (typeof obj !== 'object' || obj === null) {
        return obj; // Return non-objects as is
    }

    const copiedObject: Record<string, any> = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key) && !keysToExclude.includes(key)) {
            copiedObject[key] = obj[key];
        }
    }

    return copiedObject;
}


export const nullWalk = (val: any) => {
    if (!val) {
        return afx.NOT_ASSIGNED
    }

    return val
}

const ReferralCodeBase = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function encodeChatId(chatId: string) {
    const baseLength = ReferralCodeBase.length;

    let temp = Number(chatId)
    let encoded = '';
    while (temp > 0) {
        const remainder = temp % baseLength;
        encoded = ReferralCodeBase[remainder] + encoded;
        temp = Math.floor(temp / baseLength);
    }

    // Pad with zeros to make it 5 characters
    return encoded.padStart(5, '0');
}

export function decodeChatId(encoded: string) {
    const baseLength = ReferralCodeBase.length;

    let decoded = 0;
    const reversed = encoded.split('').reverse().join('');

    for (let i = 0; i < reversed.length; i++) {
        const char = reversed[i];
        const charValue = ReferralCodeBase.indexOf(char);
        decoded += charValue * Math.pow(baseLength, i);
    }

    return decoded.toString();
}

export const getCurrentTimeTick = (ms: boolean = false) => {

    if (ms) {
        return new Date().getTime()
    }

    return Math.floor(new Date().getTime() / 1000)
}

export const encryptPKey = (text: string) => {

    if (text.startsWith('0x')) {
        text = text.substring(2)
    }

    return crypto.aesEncrypt(text, process.env.CRYPT_KEY ?? '')
}

export const decryptPKey = (text: string) => {
    return crypto.aesDecrypt(text, process.env.CRYPT_KEY ?? '')
}


export const getWalletTokenAccount = async (wallet: PublicKey) => {

    assert(afx.web3Conn)

    const walletTokenAccount = await afx.web3Conn.getTokenAccountsByOwner(wallet, {
        programId: afx.is_token_2022() ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
    });

    return walletTokenAccount.value.map((i) => ({
        pubkey: i.pubkey,
        programId: i.account.owner,
        accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
    }));
};

export const getWalletTokenBalance = async(wallet: PublicKey | string, tokenAddress: string, tokenDecimals: number): Promise<number> => {

    if (typeof wallet === 'string') {
        wallet = new PublicKey(wallet);
    }
    const walletTokenAccounts = await getWalletTokenAccount(wallet);
    let tokenBalance = 0;
    if (walletTokenAccounts && walletTokenAccounts.length > 0) {
        for (const acc of walletTokenAccounts) {
            if (acc.accountInfo.mint.toBase58() === tokenAddress) {
                tokenBalance = Number(acc.accountInfo.amount) / (10 ** tokenDecimals);
                break
            }
        }
    }

    return tokenBalance
}

export const getWalletSOLBalance = async(wallet: PublicKey | string): Promise<number> => {

    if (typeof wallet === 'string') {
        wallet = new PublicKey(wallet);
    }
    
    assert(afx.web3Conn)
    try {
        let balance = await afx.web3Conn.getBalance(wallet) / LAMPORTS_PER_SOL
        return balance
    } catch (error) {
        console.log(error)
    }
     
    return 0
}